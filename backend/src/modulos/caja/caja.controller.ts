// src/modulos/caja/caja.controller.ts
import { Controller, Post, Body, Req, Get, BadRequestException, Param, Logger } from '@nestjs/common';
import { Prisma, ComprobanteFormato, ComprobanteEstado } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { CoberturaService } from '../suspensiones/cobertura.service';
import { SuspensionesService } from '../suspensiones/suspensiones.service';
import { CoseguroService } from '../coseguro/coseguro.service';
import { ImpresionService, ImprimirComprobanteDto } from '../impresion/impresion.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../../common/audit.service';
import type { Usuario } from '@prisma/client';

const SERIE_RC = 'RC';
const PTOVTA_RC = 0;

type MetodoDto = { metodo: string; monto: number; ref?: string };
type AplicacionDto = { 
  obligacionId?: number; 
  cuotaId?: number;
  monto: number;
};
type ReqOrg = { organizacionId?: string; ip?: string; headers?: Record<string, string> };

@Controller('caja')
export class CajaController {
  private readonly logger = new Logger(CajaController.name);

  constructor(
    private readonly contab: ContabilidadService,
    private readonly movs: MovimientosService,
    private readonly audit: AuditService,
    private readonly cobertura: CoberturaService,
    private readonly suspensiones: SuspensionesService,
    private readonly coseguro: CoseguroService,
    private readonly impresion: ImpresionService,
    private readonly prisma: PrismaService,
  ) {}

  /** Reserva número correlativo de recibo (RECIBO_AFILIADO / ptoVta=0 / serie=RC). */
  private async reservarNumeroRecibo(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    longitud = 8,
  ) {
    const tipo = 'RECIBO_AFILIADO' as const;
    for (let i = 0; i < 3; i++) {
      const exist = await tx.numerador.findUnique({
        where: {
          organizacionId_tipo_ptoVta_serie: {
            organizacionId,
            tipo,
            ptoVta: PTOVTA_RC,
            serie: SERIE_RC,
          },
        },
        select: { longitud: true },
      });
      if (exist) {
        const upd = await tx.numerador.update({
          where: {
            organizacionId_tipo_ptoVta_serie: {
              organizacionId,
              tipo,
              ptoVta: PTOVTA_RC,
              serie: SERIE_RC,
            },
          },
          data: { ultimoNumero: { increment: 1 } },
          select: { ultimoNumero: true, longitud: true },
        });
        return {
          numero: upd.ultimoNumero,
          numeroFormateado: String(upd.ultimoNumero).padStart(upd.longitud ?? longitud, '0'),
        };
      }
      const aggComp = await tx.comprobante.aggregate({
        where: { organizacionId, tipo, ptoVta: PTOVTA_RC, serie: SERIE_RC },
        _max: { numero: true },
      });
      const start = (aggComp._max.numero ?? 0) + 1;
      try {
        const created = await tx.numerador.create({
          data: {
            organizacionId,
            tipo,
            ptoVta: PTOVTA_RC,
            serie: SERIE_RC,
            ultimoNumero: start,
            longitud,
          },
          select: { ultimoNumero: true, longitud: true },
        });
        return {
          numero: created.ultimoNumero,
          numeroFormateado: String(created.ultimoNumero).padStart(
            created.longitud ?? longitud,
            '0',
          ),
        };
      } catch (e: unknown) {
        if ((e as { code?: string })?.code !== 'P2002') throw e;
      }
    }
    throw new Error('No se pudo reservar número de recibo (colisiones repetidas).');
  }

  /** Persiste el PDF en disco y devuelve storageKey + hash. */
  private async savePdfRecibo(buffer: Buffer, filename: string) {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const dir = path.join(process.cwd(), 'storage', 'comprobantes');
    await fs.mkdir(dir, { recursive: true });
    const full = path.join(dir, filename);
    await fs.writeFile(full, buffer);
    return { storageKey: `file://${full}`, hash };
  }

  /**
   * Arma los items del recibo a partir de los movimientos que acaba de crear el cobro
   * (misma fuente de verdad que /caja/pagos/:id/para-imprimir).
   */
  private async buildItemsReciboFromMovimientos(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    pagoId: bigint,
  ) {
    const movimientos = await tx.movimientoAfiliado.findMany({
      where: { organizacionId, pagoId },
      select: {
        concepto: true,
        importe: true,
        cuotaId: true,
        obligacionId: true,
      },
    });

    const cuotaIds = [...new Set(movimientos.filter((m) => m.cuotaId).map((m) => m.cuotaId!))];
    const oblIds = [...new Set(movimientos.filter((m) => m.obligacionId).map((m) => m.obligacionId!))];

    const cuotas = cuotaIds.length
      ? await tx.ordenCreditoCuota.findMany({
          where: { id: { in: cuotaIds } },
          include: {
            orden: { select: { descripcion: true, cantidadCuotas: true } },
          },
        })
      : [];
    const mapCuotas = new Map(cuotas.map((c) => [c.id.toString(), c]));

    const obls = oblIds.length
      ? await tx.obligacion.findMany({
          where: { id: { in: oblIds } },
          include: { concepto: true },
        })
      : [];
    const mapObls = new Map(obls.map((o) => [o.id.toString(), o]));

    const items: Array<{ desc: string; cantidad: number; pUnit: number; importe: number }> = [];
    const seen = new Set<string>();

    for (const m of movimientos) {
      let desc = '';
      let pUnit = 0;
      if (m.cuotaId) {
        const c = mapCuotas.get(m.cuotaId.toString());
        if (c) {
          const base = c.orden?.descripcion || '';
          const total = c.orden?.cantidadCuotas || 0;
          const periodo = c.periodoVenc || '';
          const numCuota = c.numero || 0;
          desc = base
            ? `${base} - Cuota ${numCuota}${total > 0 ? `/${total}` : ''}${periodo ? ` (${periodo})` : ''}`
            : `Cuota ${numCuota}${total > 0 ? `/${total}` : ''}${periodo ? ` (${periodo})` : ''}`;
          pUnit = Number(c.importe || 0);
        }
      } else if (m.obligacionId) {
        const o = mapObls.get(m.obligacionId.toString());
        if (o) {
          desc = o.concepto?.nombre || o.concepto?.codigo || m.concepto || 'Concepto sin nombre';
          pUnit = Number(o.monto || 0);
        }
      } else {
        desc = m.concepto || 'Pago en caja';
        pUnit = Number(m.importe);
      }
      const key = `${desc}-${Number(m.importe)}`;
      if (!seen.has(key)) {
        items.push({ desc, cantidad: 1, pUnit, importe: Number(m.importe) });
        seen.add(key);
      }
    }
    return items;
  }

  /**
   * Normaliza un período a formato "YYYY-MM" para almacenamiento.
   * Soporta: "YYYY-MM", "MM/AA", "MM/AAAA"
   */
  private normalizarPeriodo(periodo?: string | null): string | null {
    if (!periodo) return null;
    
    // Formato "YYYY-MM" (ya está normalizado)
    if (/^\d{4}-\d{2}$/.test(periodo)) {
      return periodo;
    }
    
    // Formato "MM/AA" (año de 2 dígitos)
    if (/^\d{2}\/\d{2}$/.test(periodo)) {
      const [mm, aa] = periodo.split('/');
      const año2digitos = Number(aa);
      // Asumir años 2000-2099
      const año = año2digitos < 50 ? 2000 + año2digitos : 1900 + año2digitos;
      return `${año}-${mm}`;
    }
    
    // Formato "MM/AAAA" (año de 4 dígitos)
    if (/^\d{2}\/\d{4}$/.test(periodo)) {
      const [mm, aaaa] = periodo.split('/');
      return `${aaaa}-${mm}`;
    }
    
    // Si no coincide con ningún formato, retornar null
    return null;
  }

  /* ========= NUEVO: ESTADO ========= */
  @Public() // Temporalmente público para testing
  @Get('estado')
  async estado(@Req() req: ReqOrg) {
    const org = req.organizacionId;
    if (!org) throw new BadRequestException('Falta organización');

    const last = await this.prisma.caja.findFirst({
      where: { organizacionId: org },
      orderBy: { id: 'desc' },
      select: { id: true, sede: true },
    });
    if (!last) return { abierta: false, cajaId: null, sede: null };

    const cierre = await this.prisma.asiento.findFirst({
      where: {
        organizacionId: org,
        origen: 'cierre_caja',
        referenciaId: `caja-${last.id.toString()}`,
      },
      select: { id: true },
    });

    return { abierta: !cierre, cajaId: last.id.toString(), sede: last.sede ?? null };
  }

  @Public() // Temporalmente público para testing
  @Post('abrir')
  async abrir(
    @Req() req: ReqOrg,
    @Body() dto: { sede?: string },
    @CurrentUser() user?: Usuario,
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    const caja = await this.prisma.caja.create({ data: { organizacionId: org, sede: dto.sede ?? null } });
    if (user) {
      await this.audit.log({
        usuarioId: user.id.toString(),
        organizacionId: org,
        accion: 'CAJA_ABRIR',
        entidad: 'Caja',
        entidadId: caja.id.toString(),
        payloadDespues: { sede: dto.sede, cajaId: caja.id.toString() },
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
    }
    return caja;
  }

  @Post('cobrar')
  async cobrar(
    @Req() req: ReqOrg,
    @CurrentUser() user: Usuario,
    @Body()
    dto: {
      cajaId: number;
      afiliadoId: number;
      metodos: MetodoDto[];
      aplicaciones: AplicacionDto[];
    },
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    const totalMetodos = dto.metodos.reduce((a, b) => a + Number(b.monto), 0);
    const totalAplic = dto.aplicaciones.reduce((a, b) => a + Number(b.monto), 0);
    if (Number(totalMetodos.toFixed(2)) !== Number(totalAplic.toFixed(2))) {
      throw new Error('La suma de métodos debe igualar la suma aplicada');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const pago = await tx.pago.create({
        data: {
          organizacionId: org,
          cajaId: BigInt(dto.cajaId),
          afiliadoId: BigInt(dto.afiliadoId),
          total: totalMetodos,
          numeroRecibo: null,
          origen: 'caja',
        },
      });

      for (const m of dto.metodos) {
        await tx.metodoPago.create({
          data: { pagoId: pago.id, metodo: m.metodo, monto: m.monto, ref: m.ref ?? null },
        });
      }

      // Separar obligaciones y cuotas
      const aplicacionesObl = dto.aplicaciones.filter((a) => a.obligacionId);
      const aplicacionesCuota = dto.aplicaciones.filter((a) => a.cuotaId);

      // ===== Procesar obligaciones =====
      if (aplicacionesObl.length > 0) {
        const idsObl = aplicacionesObl.map((a) => BigInt(a.obligacionId!));
        const obligaciones = await tx.obligacion.findMany({
          where: { id: { in: idsObl }, organizacionId: org },
          include: { concepto: true, padron: true },
        });
        const mapaObl = new Map(obligaciones.map((o) => [o.id.toString(), o]));

        for (const a of aplicacionesObl) {
          const obl = mapaObl.get(BigInt(a.obligacionId!).toString());
          if (!obl) throw new Error(`Obligación ${a.obligacionId} inválida`);
          const nuevoSaldo = Number(obl.saldo) - Number(a.monto);
          if (nuevoSaldo < -0.01) throw new Error('Aplicación supera saldo');

          await tx.obligacion.update({
            where: { id: obl.id },
            data: {
              saldo: nuevoSaldo,
              estado: nuevoSaldo <= 0.009 ? 'pagada' : 'parcialmente_pagada',
            },
          });

          await tx.aplicacion.create({
            data: { pagoId: pago.id, obligacionId: obl.id, monto: a.monto },
          });
        }
      }

      // ===== Procesar cuotas de órdenes de crédito =====
      let mapaCuota = new Map<any, any>();
      if (aplicacionesCuota.length > 0) {
        const idsCuota = aplicacionesCuota.map((a) => BigInt(a.cuotaId!));
        const cuotas = await tx.ordenCreditoCuota.findMany({
          where: { id: { in: idsCuota } },
          include: {
            orden: {
              select: { organizacionId: true, afiliadoId: true },
            },
          },
        });

        mapaCuota = new Map(cuotas.map((c) => [c.id.toString(), c]));

        for (const a of aplicacionesCuota) {
          const cuota = mapaCuota.get(BigInt(a.cuotaId!).toString());
          if (!cuota || cuota.orden.organizacionId !== org || cuota.orden.afiliadoId !== BigInt(dto.afiliadoId)) {
            throw new Error(`Cuota ${a.cuotaId} inválida`);
          }
          const nuevoSaldo = Number(cuota.saldo) - Number(a.monto);
          if (nuevoSaldo < -0.01) throw new Error('Aplicación supera saldo');

          await tx.ordenCreditoCuota.update({
            where: { id: cuota.id },
            data: {
              saldo: nuevoSaldo,
              cancelado: Number(cuota.cancelado) + Number(a.monto),
              estado: nuevoSaldo <= 0.009 ? 'pagada' : nuevoSaldo < Number(cuota.importe) ? 'parcialmente_pagada' : cuota.estado,
            },
          });

          // Actualizar saldo total de la orden
          const orden = await tx.ordenCredito.findUnique({
            where: { id: cuota.ordenId },
            include: { cuotas: true },
          });
          if (orden) {
            const saldoTotalOrden = orden.cuotas.reduce((sum, c) => sum + Number(c.saldo), 0);
            await tx.ordenCredito.update({
              where: { id: cuota.ordenId },
              data: {
                saldoTotal: saldoTotalOrden,
                estado: saldoTotalOrden <= 0.009 ? 'cancelada' : 'en_curso',
              },
            });
          }

          // Crear aplicación (si hay obligación vinculada, usarla)
          if (cuota.obligacionId) {
            await tx.aplicacion.create({
              data: { pagoId: pago.id, obligacionId: cuota.obligacionId, monto: a.monto },
            });
          }
          // Si no hay obligación vinculada, la cuota se registrará mediante el movimiento
          // que se crea más abajo con cuotaId vinculado
        }
      }

      // ======================= CONTABILIDAD =======================
      const mapeos = await tx.cuentaMapeo.findMany({
        where: { organizacionId: org, origen: 'pago_caja', activo: true },
      });

      const pickMap = (opts: { conceptoCodigo?: string | null; metodo?: string | null }) => {
        const { conceptoCodigo, metodo } = opts;
        return (
          mapeos.find((m) => m.conceptoCodigo === conceptoCodigo && m.metodoPago === metodo) ??
          mapeos.find((m) => m.conceptoCodigo === conceptoCodigo && m.metodoPago == null) ??
          mapeos.find((m) => m.conceptoCodigo == null && m.metodoPago === metodo) ??
          mapeos.find((m) => m.conceptoCodigo == null && m.metodoPago == null) ??
          null
        );
      };

      const lineasDebe: Record<string, number> = {};
      const lineasHaber: Record<string, number> = {};

      // DEBE por método
      for (const m of dto.metodos) {
        const map = pickMap({ metodo: m.metodo, conceptoCodigo: null });
        const cuentaDebe = map?.debeCodigo ?? (m.metodo === 'efectivo' ? '1101' : '1102');
        lineasDebe[cuentaDebe] = (lineasDebe[cuentaDebe] ?? 0) + Number(m.monto);
      }

      // HABER por concepto (obligaciones)
      if (aplicacionesObl.length > 0) {
        const mapaObl = new Map(
          (await tx.obligacion.findMany({
            where: { id: { in: aplicacionesObl.map((a) => BigInt(a.obligacionId!)) } },
            include: { concepto: true },
          })).map((o) => [o.id.toString(), o])
        );

        for (const a of aplicacionesObl) {
          const obl = mapaObl.get(BigInt(a.obligacionId!).toString());
          if (!obl) continue;
          const conceptoCodigo = obl.concepto?.codigo ?? null;
          const metodoPrincipal = dto.metodos[0]?.metodo ?? null;

          const map = pickMap({ metodo: metodoPrincipal, conceptoCodigo });
          let defHaber = '4101';
          if (conceptoCodigo === 'ORDEN_CREDITO') defHaber = '4102';
          const cuentaHaber = map?.haberCodigo ?? defHaber;

          lineasHaber[cuentaHaber] = (lineasHaber[cuentaHaber] ?? 0) + Number(a.monto);
        }
      }

      // HABER por concepto (cuotas de órdenes de crédito)
      if (aplicacionesCuota.length > 0) {
        const metodoPrincipal = dto.metodos[0]?.metodo ?? null;
        const map = pickMap({ metodo: metodoPrincipal, conceptoCodigo: 'ORDEN_CREDITO' });
        const cuentaHaber = map?.haberCodigo ?? '4102'; // Cuenta para órdenes de crédito

        for (const a of aplicacionesCuota) {
          lineasHaber[cuentaHaber] = (lineasHaber[cuentaHaber] ?? 0) + Number(a.monto);
        }
      }

      const totalDebe = Object.values(lineasDebe).reduce((a, b) => a + b, 0);
      const totalHaber = Object.values(lineasHaber).reduce((a, b) => a + b, 0);
      const diff = Number((totalDebe - totalHaber).toFixed(2));
      if (Math.abs(diff) > 0.01) {
        if (diff > 0) lineasHaber['1301'] = (lineasHaber['1301'] ?? 0) + diff;
        else lineasDebe['1301'] = (lineasDebe['1301'] ?? 0) + -diff;
      }

      await tx.asiento.create({
        data: {
          organizacionId: org,
          descripcion: `Pago en Caja ID ${pago.id.toString()}`,
          origen: 'pago_caja',
          referenciaId: pago.id.toString(),
          lineas: {
            create: [
              ...Object.entries(lineasDebe).map(([cuenta, importe]) => ({
                cuenta,
                debe: importe,
                haber: 0,
              })),
              ...Object.entries(lineasHaber).map(([cuenta, importe]) => ({
                cuenta,
                debe: 0,
                haber: importe,
              })),
            ],
          },
        },
      });
      // ======================= /CONTABILIDAD ======================

      // ======================= MOVIMIENTO DE CREDITO ======================
      // Obtener último saldo del afiliado
      const lastMov = await tx.movimientoAfiliado.findFirst({
        where: { organizacionId: org, afiliadoId: BigInt(dto.afiliadoId) },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        select: { saldoPosterior: true },
      });
      let saldoActual = Number(lastMov?.saldoPosterior || 0);

      // Crear movimientos individuales para cada aplicación (para mejor trazabilidad)
      // Primero, procesar obligaciones que tienen aplicaciones (directas)
      if (aplicacionesObl.length > 0) {
        const obligaciones = await tx.obligacion.findMany({
          where: { 
            id: { in: aplicacionesObl.map((a) => BigInt(a.obligacionId!)) },
            organizacionId: org,
          },
          include: { concepto: true, padron: true },
        });
        const mapaObl = new Map(obligaciones.map((o) => [o.id.toString(), o]));

        for (const a of aplicacionesObl) {
          const obl = mapaObl.get(BigInt(a.obligacionId!).toString());
          if (!obl) continue;
          
          saldoActual = saldoActual - Number(a.monto);
          
          await tx.movimientoAfiliado.create({
            data: {
              organizacionId: org,
              afiliadoId: BigInt(dto.afiliadoId),
              padronId: obl.padronId,
              fecha: new Date(),
              naturaleza: 'credito',
              origen: 'pago_caja',
              concepto: obl.concepto?.nombre || obl.concepto?.codigo || 'Pago en caja',
              importe: new Prisma.Decimal(a.monto),
              saldoPosterior: new Prisma.Decimal(saldoActual),
              obligacionId: obl.id,
              pagoId: pago.id,
              asientoId: null,
            },
          });
        }
      }

      // Procesar TODAS las cuotas (con y sin obligación vinculada)
      if (aplicacionesCuota.length > 0) {
        const idsCuota = aplicacionesCuota.map((a) => BigInt(a.cuotaId!));
        const cuotasDetalle = await tx.ordenCreditoCuota.findMany({
          where: { id: { in: idsCuota } },
          include: {
            orden: {
              select: {
                id: true,
                descripcion: true,
                padronId: true,
                cantidadCuotas: true,
              },
            },
          },
        });
        const mapaCuotaDetalle = new Map(cuotasDetalle.map((c) => [c.id.toString(), c]));

        for (const a of aplicacionesCuota) {
          const cuota = mapaCuotaDetalle.get(BigInt(a.cuotaId!).toString());
          if (!cuota) continue;

          saldoActual = saldoActual - Number(a.monto);

          // Construir concepto descriptivo
          let concepto = cuota.orden?.descripcion || '';
          const periodoVenc = cuota.periodoVenc || '';
          const cuotaNum = cuota.numero || 0;
          const cuotaTotal = cuota.orden?.cantidadCuotas || 0;
          
          if (concepto) {
            concepto = `${concepto} - Cuota ${cuotaNum}${cuotaTotal > 0 ? `/${cuotaTotal}` : ''}${periodoVenc ? ` (${periodoVenc})` : ''}`;
          } else {
            concepto = `Cuota ${cuotaNum}${cuotaTotal > 0 ? `/${cuotaTotal}` : ''}${periodoVenc ? ` (${periodoVenc})` : ''}`;
          }

          // OPCIÓN A: Usar fecha física del pago + periodoContable para agrupación
          // - fecha: fecha física del pago (para orden cronológico y cálculo correcto de saldo)
          // - periodoContable: período al que corresponde (para agrupar/reportes)
          const periodoContable = this.normalizarPeriodo(periodoVenc);

          await tx.movimientoAfiliado.create({
            data: {
              organizacionId: org,
              afiliadoId: BigInt(dto.afiliadoId),
              padronId: cuota.orden?.padronId,
              fecha: new Date(), // 👈 Fecha física del pago (orden cronológico correcto)
              periodoContable, // 👈 Período contable para agrupar por período cuando se necesite
              naturaleza: 'credito',
              origen: 'pago_caja',
              concepto,
              importe: new Prisma.Decimal(a.monto),
              saldoPosterior: new Prisma.Decimal(saldoActual),
              cuotaId: cuota.id,
              ordenId: cuota.ordenId,
              // Si la cuota tiene obligación vinculada, también vincularla
              obligacionId: cuota.obligacionId || null,
              pagoId: pago.id,
              asientoId: null,
            },
          });
        }
      }

      // Verificar que todos los montos tengan movimiento
      const totalConMovimiento = aplicacionesObl.reduce((sum, a) => sum + Number(a.monto), 0) +
                                  aplicacionesCuota.reduce((sum, a) => sum + Number(a.monto), 0);
      const restante = totalMetodos - totalConMovimiento;

      // Si hay diferencia (no debería pasar, pero por seguridad)
      if (Math.abs(restante) > 0.01) {
        saldoActual = saldoActual - restante;
        await tx.movimientoAfiliado.create({
          data: {
            organizacionId: org,
            afiliadoId: BigInt(dto.afiliadoId),
            padronId: null,
            fecha: new Date(),
            naturaleza: 'credito',
            origen: 'pago_caja',
            concepto: `Pago en caja #${pago.id.toString()} - ${dto.metodos.map((m) => `${m.metodo} $${m.monto.toFixed(2)}`).join(', ')}`,
            importe: new Prisma.Decimal(restante),
            saldoPosterior: new Prisma.Decimal(saldoActual),
            pagoId: pago.id,
            asientoId: null,
          },
        });
      }

      // Actualizar saldo del afiliado
      await tx.afiliado.update({
        where: { id: BigInt(dto.afiliadoId) },
        data: { saldo: new Prisma.Decimal(saldoActual) },
      });
      // ======================= /MOVIMIENTO DE CREDITO ======================

      // ======================= COMPROBANTE: RECIBO_AFILIADO ===============
      // Reservamos número, renderizamos PDF y persistimos el Comprobante en la
      // misma transacción para garantizar que cada Pago de caja queda con su
      // recibo correlativo y archivable.
      const afiliadoBasico = await tx.afiliado.findUnique({
        where: { id: BigInt(dto.afiliadoId) },
        select: { nombre: true, apellido: true, dni: true, cuit: true },
      });
      const nombreCompleto = afiliadoBasico
        ? `${afiliadoBasico.apellido || ''}${
            afiliadoBasico.apellido && afiliadoBasico.nombre ? ', ' : ''
          }${afiliadoBasico.nombre || ''}`.trim()
        : '';

      const itemsRecibo = await this.buildItemsReciboFromMovimientos(tx, org, pago.id);
      const itemsFallback = itemsRecibo.length
        ? itemsRecibo
        : [{ desc: 'Pago en caja', cantidad: 1, pUnit: totalMetodos, importe: totalMetodos }];

      const seq = await this.reservarNumeroRecibo(tx, org);

      const dtoImp: ImprimirComprobanteDto = {
        tipo: 'RECIBO_AFILIADO',
        formato: 'A4',
        copias: 2,
        titulo: 'RECIBO',
        numero: seq.numeroFormateado,
        fecha: pago.fecha.toISOString(),
        tercero: {
          nombre: nombreCompleto || 'N/A',
          cuit: afiliadoBasico?.cuit ?? (afiliadoBasico?.dni != null ? String(afiliadoBasico.dni) : null),
        },
        items: itemsFallback,
        subtotal: totalMetodos,
        descuentos: 0,
        percepciones: 0,
        impuestos: 0,
        total: totalMetodos,
        notas: `Métodos: ${dto.metodos
          .map((m) => `${m.metodo} $${Number(m.monto).toFixed(2)}`)
          .join(', ')}`,
      };

      const { buffer, filename } = await this.impresion.render(org, dtoImp);
      const { storageKey, hash } = await this.savePdfRecibo(
        buffer as unknown as Buffer,
        filename,
      );

      const comp = await tx.comprobante.create({
        data: {
          organizacionId: org,
          tipo: 'RECIBO_AFILIADO',
          ptoVta: PTOVTA_RC,
          serie: SERIE_RC,
          numero: seq.numero,
          numeroCompleto: seq.numeroFormateado,
          titulo: dtoImp.titulo ?? null,
          fechaEmision: pago.fecha,
          terceroNombre: dtoImp.tercero?.nombre ?? null,
          terceroCuit: dtoImp.tercero?.cuit ?? null,
          subtotal: new Prisma.Decimal(dtoImp.subtotal ?? 0),
          descuentos: new Prisma.Decimal(dtoImp.descuentos ?? 0),
          percepciones: new Prisma.Decimal(dtoImp.percepciones ?? 0),
          impuestos: new Prisma.Decimal(dtoImp.impuestos ?? 0),
          total: new Prisma.Decimal(dtoImp.total ?? 0),
          notas: dtoImp.notas ?? null,
          formato: ComprobanteFormato.A4,
          copias: dtoImp.copias ?? 2,
          templateArchivo: 'recibo_afiliado.a4.njk',
          templateCss: 'a4.css',
          templateVersion: process.env.TEMPLATES_VERSION ?? null,
          pdfStorageKey: storageKey,
          pdfHash: hash,
          payload: {
            ...dtoImp,
            origen: { pagoId: pago.id.toString(), cajaId: dto.cajaId },
          } as unknown as Prisma.InputJsonValue,
          estado: ComprobanteEstado.EMITIDO,
        },
        select: { id: true, numeroCompleto: true },
      });

      if (itemsFallback.length) {
        await tx.comprobanteItem.createMany({
          data: itemsFallback.map((it, i) => ({
            comprobanteId: comp.id,
            orden: i + 1,
            desc: it.desc,
            cantidad: new Prisma.Decimal(it.cantidad ?? 1),
            pUnit: it.pUnit != null ? new Prisma.Decimal(it.pUnit) : null,
            importe: new Prisma.Decimal(it.importe ?? 0),
          })),
        });
      }

      await tx.pago.update({
        where: { id: pago.id },
        data: {
          comprobanteId: comp.id,
          numeroRecibo: seq.numeroFormateado,
        },
      });
      // ======================= /COMPROBANTE ===============================

      const pagoCompleto = await tx.pago.findUnique({
        where: { id: pago.id },
        include: {
          metodos: true,
          aplicaciones: {
            include: {
              obligacion: {
                include: {
                  concepto: true,
                  padron: true,
                },
              },
            },
          },
          afiliado: {
            select: {
              id: true,
              nombre: true,
              apellido: true,
              dni: true,
              cuit: true,
            },
          },
        },
      });

      await this.audit.log({
        usuarioId: user.id.toString(),
        organizacionId: org,
        accion: 'CAJA_COBRAR',
        entidad: 'Pago',
        entidadId: pago.id.toString(),
        payloadDespues: {
          afiliadoId: dto.afiliadoId,
          total: totalMetodos,
          cajaId: dto.cajaId,
          comprobanteId: comp.id,
          numeroRecibo: seq.numeroFormateado,
        },
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });

      return {
        ...pagoCompleto,
        comprobanteId: comp.id,
        comprobanteNumero: comp.numeroCompleto,
        numeroRecibo: seq.numeroFormateado,
        pdfFilename: filename,
      };
    });

    // ───── Hook post-pago: recalcular cobertura + rehabilitar si corresponde ─────
    //
    // Tras un pago por caja, los J17/J22/J38 del padrón pueden haber quedado
    // cubiertos y el afiliado pasar de mora a al día. Recalculamos la cobertura
    // para cada período tocado por las aplicaciones y, si el afiliado estaba
    // suspendido, intentamos rehabilitarlo.
    //
    // Si esto falla NO revertimos el pago — el pago ya quedó commiteado.
    // Lo loggeamos y seguimos.
    try {
      const afiliadoIdBig = BigInt(dto.afiliadoId);
      const periodosAfectados = await this.calcularPeriodosAfectadosPorPago(
        org,
        dto.aplicaciones,
      );
      if (periodosAfectados.length > 0) {
        await Promise.all(
          periodosAfectados.map((p) =>
            this.cobertura
              .calcular(org, afiliadoIdBig, p)
              .catch((e) =>
                this.logger.warn(
                  `Fallo al recalcular cobertura af=${afiliadoIdBig} per=${p}: ${
                    e instanceof Error ? e.message : String(e)
                  }`,
                ),
              ),
          ),
        );
      }

      const suspendido = await this.suspensiones.estaSuspendido(org, afiliadoIdBig);
      if (suspendido) {
        try {
          await this.suspensiones.rehabilitar(org, afiliadoIdBig, 'pago_caja', {
            usuarioId: user?.id?.toString(),
          });
        } catch {
          // Hay deuda anterior que el pago no cubrió → queda suspendido. No es error.
        }
      }

      // Reactivación automática de coseguro si fue dado de baja por el job
      // de 3 meses y el pago saldó toda la deuda J22 pendiente.
      await this.reactivarCoseguroAutoSiCorresponde(org, afiliadoIdBig);
    } catch (e) {
      this.logger.error(
        `Hook post-pago caja falló (pago ${result?.id?.toString()}): ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }

    return result;
  }

  /**
   * Si el coseguro está en estado 'baja' con `origenBaja='auto_3m_sin_j22'`
   * y ya no quedan obligaciones J22 abiertas (porque el pago las canceló),
   * lo reactiva automáticamente reutilizando el padrón de imputación previo.
   *
   * NO reactiva si la baja fue manual (`manual_operador`) o por cascada
   * (`padron_inactivo`): esas requieren acción explícita del operador.
   */
  private async reactivarCoseguroAutoSiCorresponde(
    orgId: string,
    afiliadoId: bigint,
  ): Promise<void> {
    const cos = await this.prisma.coseguroAfiliado.findFirst({
      where: { organizacionId: orgId, afiliadoId },
      select: {
        id: true,
        estado: true,
        origenBaja: true,
        imputacionPadronIdCoseguro: true,
      },
    });
    if (!cos) return;
    if (cos.estado !== 'baja') return;
    if (cos.origenBaja !== 'auto_3m_sin_j22') return;
    if (!cos.imputacionPadronIdCoseguro) return;

    const conceptoJ22 = await this.prisma.concepto.findFirst({
      where: { organizacionId: orgId, codigo: 'COSEGURO' },
      select: { id: true },
    });
    if (!conceptoJ22) return;

    const tieneJ22Abiertas = await this.prisma.obligacion.findFirst({
      where: {
        organizacionId: orgId,
        afiliadoId,
        conceptoId: conceptoJ22.id,
        estado: { in: ['pendiente', 'parcialmente_pagada'] },
        saldo: { gt: 0 },
      },
      select: { id: true },
    });
    if (tieneJ22Abiertas) return; // todavía hay deuda → no reactiva

    try {
      // Reusa el padrón de imputación que tenía antes de la baja.
      // altaCoseguro va a:
      //   - poner estado='activo' + origenBaja=null,
      //   - emitir NovedadPendiente(J22, alta) automáticamente.
      await this.coseguro.altaCoseguro(orgId, afiliadoId, cos.imputacionPadronIdCoseguro);
      this.logger.log(
        `Coseguro reactivado automáticamente para afiliado ${afiliadoId} (deuda J22 saldada).`,
      );
    } catch (e) {
      this.logger.warn(
        `No se pudo reactivar coseguro auto para afiliado ${afiliadoId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  /**
   * Devuelve los períodos contables (YYYY-MM) afectados por las aplicaciones
   * del pago: para obligaciones toma `obligacion.periodo`; para cuotas toma
   * `cuota.periodoVenc` normalizado. Devuelve set único.
   */
  private async calcularPeriodosAfectadosPorPago(
    orgId: string,
    aplicaciones: AplicacionDto[],
  ): Promise<string[]> {
    const periodos = new Set<string>();
    const oblIds = aplicaciones
      .filter((a) => a.obligacionId)
      .map((a) => BigInt(a.obligacionId!));
    if (oblIds.length > 0) {
      const obls = await this.prisma.obligacion.findMany({
        where: { id: { in: oblIds }, organizacionId: orgId },
        select: { periodo: true },
      });
      for (const o of obls) if (o.periodo) periodos.add(o.periodo);
    }
    const cuotaIds = aplicaciones
      .filter((a) => a.cuotaId)
      .map((a) => BigInt(a.cuotaId!));
    if (cuotaIds.length > 0) {
      const cuotas = await this.prisma.ordenCreditoCuota.findMany({
        where: { id: { in: cuotaIds } },
        select: { periodoVenc: true },
      });
      for (const c of cuotas) {
        const norm = this.normalizarPeriodo(c.periodoVenc);
        if (norm) periodos.add(norm);
      }
    }
    return Array.from(periodos);
  }

  @Get('pagos/:pagoId/para-imprimir')
  @Public()
  async getPagoParaImprimir(@Req() req: ReqOrg, @Param('pagoId') pagoId: string) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    const pago = await this.prisma.pago.findUnique({
      where: {
        id: BigInt(pagoId),
        organizacionId: org,
      },
      include: {
        metodos: true,
        aplicaciones: {
          include: {
            obligacion: {
              include: {
                concepto: true,
                padron: true,
              },
            },
          },
        },
        afiliado: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            dni: true,
            cuit: true,
          },
        },
      },
    });

    if (!pago) throw new BadRequestException('Pago no encontrado');

    // Formatear para impresión
    const nombreCompleto = pago.afiliado
      ? `${pago.afiliado.apellido || ''}${pago.afiliado.apellido && pago.afiliado.nombre ? ', ' : ''}${pago.afiliado.nombre || ''}`.trim()
      : 'N/A';

    const items: Array<{ desc: string; cantidad: number; pUnit: number; importe: number }> = [];
    const itemsAgregados = new Set<string>(); // Para evitar duplicados

    // Obtener TODOS los movimientos relacionados con este pago (fuente de verdad)
    const movimientos = await this.prisma.movimientoAfiliado.findMany({
      where: {
        organizacionId: org,
        pagoId: BigInt(pagoId),
      },
      select: {
        id: true,
        concepto: true,
        importe: true,
        cuotaId: true,
        obligacionId: true,
        ordenId: true,
      },
    });

    // Obtener IDs únicos de cuotas y obligaciones
    const cuotaIds = [...new Set(movimientos.filter((m) => m.cuotaId).map((m) => m.cuotaId!))];
    const obligacionIds = [...new Set(movimientos.filter((m) => m.obligacionId).map((m) => m.obligacionId!))];

    // Obtener cuotas con sus órdenes
    const cuotas = cuotaIds.length > 0
      ? await this.prisma.ordenCreditoCuota.findMany({
          where: { id: { in: cuotaIds } },
          include: {
            orden: {
              select: {
                id: true,
                descripcion: true,
                cantidadCuotas: true,
              },
            },
          },
        })
      : [];
    const mapaCuotas = new Map(cuotas.map((c) => [c.id.toString(), c]));

    // Obtener obligaciones con sus conceptos
    const obligaciones = obligacionIds.length > 0
      ? await this.prisma.obligacion.findMany({
          where: { id: { in: obligacionIds } },
          include: {
            concepto: true,
          },
        })
      : [];
    const mapaObligaciones = new Map(obligaciones.map((o) => [o.id.toString(), o]));

    // Procesar movimientos para construir items
    for (const mov of movimientos) {
      let desc = '';
      let pUnit = 0;

      // Prioridad 1: Si tiene cuota, usar información de la cuota
      if (mov.cuotaId) {
        const cuota = mapaCuotas.get(mov.cuotaId.toString());
        if (cuota) {
          const ordenDesc = cuota.orden?.descripcion || '';
          const periodoVenc = cuota.periodoVenc || '';
          const cuotaNum = cuota.numero || 0;
          const cuotaTotal = cuota.orden?.cantidadCuotas || 0;
          
          desc = ordenDesc 
            ? `${ordenDesc} - Cuota ${cuotaNum}${cuotaTotal > 0 ? `/${cuotaTotal}` : ''}${periodoVenc ? ` (${periodoVenc})` : ''}`
            : `Cuota ${cuotaNum}${cuotaTotal > 0 ? `/${cuotaTotal}` : ''}${periodoVenc ? ` (${periodoVenc})` : ''}`;
          pUnit = Number(cuota.importe || 0);
        }
      }
      // Prioridad 2: Si tiene obligación, usar información de la obligación
      else if (mov.obligacionId) {
        const obl = mapaObligaciones.get(mov.obligacionId.toString());
        if (obl) {
          desc = obl.concepto?.nombre || obl.concepto?.codigo || mov.concepto || 'Concepto sin nombre';
          pUnit = Number(obl.monto || 0);
        }
      }
      // Prioridad 3: Usar el concepto del movimiento
      else {
        desc = mov.concepto || 'Pago en caja';
        pUnit = Number(mov.importe);
      }

      // Agregar item si no está duplicado (usar desc + importe como clave)
      const key = `${desc}-${Number(mov.importe)}`;
      if (!itemsAgregados.has(key)) {
        items.push({
          desc,
          cantidad: 1,
          pUnit,
          importe: Number(mov.importe),
        });
        itemsAgregados.add(key);
      }
    }

    // Si aún no hay items, intentar usar las aplicaciones directamente
    if (items.length === 0 && pago.aplicaciones.length > 0) {
      // Si no hay movimientos pero hay aplicaciones, usar las aplicaciones
      for (const app of pago.aplicaciones) {
        if (app.obligacion) {
          const concepto = app.obligacion.concepto?.nombre || app.obligacion.concepto?.codigo || 'Concepto sin nombre';
          items.push({
            desc: concepto,
            cantidad: 1,
            pUnit: Number(app.obligacion.monto || 0),
            importe: Number(app.monto),
          });
        }
      }
    }
    
    // Si aún no hay items después de revisar aplicaciones, usar un concepto genérico
    if (items.length === 0) {
      items.push({
        desc: 'Pago en caja',
        cantidad: 1,
        pUnit: Number(pago.total),
        importe: Number(pago.total),
      });
    }

    // Convertir fecha a ISO string
    const fechaISO = pago.fecha instanceof Date 
      ? pago.fecha.toISOString() 
      : typeof pago.fecha === 'string'
      ? new Date(pago.fecha).toISOString()
      : new Date().toISOString();

    return {
      tipo: 'RECIBO_AFILIADO' as const,
      numero: pago.id.toString(),
      fecha: fechaISO,
      tercero: pago.afiliado
        ? {
            nombre: nombreCompleto,
            cuit: pago.afiliado.cuit || pago.afiliado.dni || null,
          }
        : null,
      items,
      total: Number(pago.total),
      notas: `Pago registrado en caja. Métodos: ${pago.metodos.map((m) => `${m.metodo} $${Number(m.monto).toFixed(2)}`).join(', ')}`,
    };
  }

  @Get('pagos/:pagoId')
  @Public()
  async getPago(@Req() req: ReqOrg, @Param('pagoId') pagoId: string) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    const pago = await this.prisma.pago.findUnique({
      where: {
        id: BigInt(pagoId),
        organizacionId: org,
      },
      include: {
        metodos: true,
        aplicaciones: {
          include: {
            obligacion: {
              include: {
                concepto: true,
                padron: true,
              },
            },
          },
        },
        afiliado: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            dni: true,
            cuit: true,
          },
        },
      },
    });

    if (!pago) throw new BadRequestException('Pago no encontrado');
    return pago;
  }

  /**
   * Cierre ciego de caja:
   * - Recibe montos del front (teórico + declarado) y opcional metodoPago
   * - Genera asiento de ajuste solo si hay diferencia
   */
  @Post('cerrar')
  async cerrar(
    @Req() req: ReqOrg,
    @CurrentUser() user: Usuario,
    @Body()
    body:
      | {
          // MODO 1 (simple, compat hacia atrás)
          montoDeclarado: number;
          montoTeorico: number;
          metodoPago?: string | null;
          referenciaId?: string | null;
          descripcion?: string | null;
        }
      | {
          // MODO 2 (lote por método)
          items: Array<{ metodo: string | null; declarado: number; teorico: number }>;
          referenciaId?: string | null;
          descripcion?: string | null;
        },
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    return this.prisma.$transaction(async (tx) => {
      // --- MODO 2: lote por método
      if ('items' in body && Array.isArray(body.items) && body.items.length > 0) {
        const itemsValidos = (body.items ?? [])
          .map((i) => ({
            metodoPago: i.metodo ?? null,
            declarado: Number(i.declarado) || 0,
            teorico: Number(i.teorico) || 0,
          }))
          .filter((i) => Number.isFinite(i.declarado) && Number.isFinite(i.teorico));

        if (itemsValidos.length === 0) {
          throw new Error('Items de cierre inválidos');
        }
        const { diffTotal, lineas } = await this.contab.lineasCierreCajaLote(
          org,
          body.items.map((it) => ({
            metodoPago: it.metodo ?? null,
            declarado: it.declarado,
            teorico: it.teorico,
          })),
        );

        if (lineas.length === 0) {
          return { diff: diffTotal, asientoId: null, ok: true, mensaje: 'Cierre sin diferencias.' };
        }

        const asiento = await this.contab.crearAsiento(tx, {
          organizacionId: org,
          descripcion: body.descripcion ?? 'Cierre de caja (lote por método)',
          origen: 'cierre_caja',
          referenciaId: body.referenciaId ?? null,
          lineas,
        });

        await this.audit.log({
          usuarioId: user.id.toString(),
          organizacionId: org,
          accion: 'CAJA_CERRAR',
          entidad: 'Caja',
          entidadId: body.referenciaId ?? undefined,
          payloadDespues: { asientoId: asiento.id.toString(), diffTotal },
          ipAddress: req.ip,
          userAgent: req.headers?.['user-agent'],
        });

        return { diff: diffTotal, asientoId: asiento.id.toString(), ok: true };
      }

      // --- MODO 1: simple (el que ya tenías)
      const { montoDeclarado, montoTeorico, metodoPago = null, referenciaId = null } = body as any;

      const { diff, lineas } = await this.contab.lineasCierreCaja(org, {
        montoDeclarado,
        montoTeorico,
        metodoPago,
      });

      if (lineas.length === 0) {
        return { diff, asientoId: null, mensaje: 'Cierre sin diferencia: no se generó asiento.' };
      }

      const asiento = await this.contab.crearAsiento(tx, {
        organizacionId: org,
        descripcion: (body as any).descripcion ?? `Cierre de caja (${metodoPago ?? 'general'})`,
        origen: 'cierre_caja',
        referenciaId,
        lineas,
      });

      await this.audit.log({
        usuarioId: user.id.toString(),
        organizacionId: org,
        accion: 'CAJA_CERRAR',
        entidad: 'Caja',
        entidadId: referenciaId,
        payloadDespues: { asientoId: asiento.id.toString(), diff },
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });

      return { diff, asientoId: asiento.id.toString(), ok: true };
    });
  }
}
