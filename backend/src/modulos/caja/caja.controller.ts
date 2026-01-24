// src/modulos/caja/caja.controller.ts
import { Controller, Post, Body, Req, Get, BadRequestException, Param } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { Public } from '../auth/decorators/public.decorator';
const prisma = new PrismaClient();

type MetodoDto = { metodo: string; monto: number; ref?: string };
type AplicacionDto = { 
  obligacionId?: number; 
  cuotaId?: number;
  monto: number;
};
type ReqOrg = { organizacionId?: string };

@Controller('caja')
export class CajaController {
  constructor(
    private readonly contab: ContabilidadService,
    private readonly movs: MovimientosService,
  ) {}

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

    const last = await prisma.caja.findFirst({
      where: { organizacionId: org },
      orderBy: { id: 'desc' },
      select: { id: true, sede: true },
    });
    if (!last) return { abierta: false, cajaId: null, sede: null };

    const cierre = await prisma.asiento.findFirst({
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
  async abrir(@Req() req: ReqOrg, @Body() dto: { sede?: string }) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return prisma.caja.create({ data: { organizacionId: org, sede: dto.sede ?? null } });
  }

  @Post('cobrar')
  async cobrar(
    @Req() req: ReqOrg,
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

    return prisma.$transaction(async (tx) => {
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

      return pagoCompleto;
    });
  }

  @Get('pagos/:pagoId/para-imprimir')
  @Public()
  async getPagoParaImprimir(@Req() req: ReqOrg, @Param('pagoId') pagoId: string) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    const pago = await prisma.pago.findUnique({
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
    const movimientos = await prisma.movimientoAfiliado.findMany({
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
      ? await prisma.ordenCreditoCuota.findMany({
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
      ? await prisma.obligacion.findMany({
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

    const pago = await prisma.pago.findUnique({
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
  // src/modulos/caja/caja.controller.ts
  @Post('cerrar')
  async cerrar(
    @Req() req: ReqOrg,
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

    return prisma.$transaction(async (tx) => {
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

      return { diff, asientoId: asiento.id.toString(), ok: true };
    });
  }
}
