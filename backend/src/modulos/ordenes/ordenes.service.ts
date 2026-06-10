// src/modulos/ordenes/ordenes.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CrearOrdenCreditoDto, PreviewOrdenCreditoDto } from './dto';
import { PrismaService } from 'src/common/prisma.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { CupoService } from '../cupo/cupo.service';

type PreviewCuota = { numero: number; periodoVenc: string; importe: string };
type PreviewResp = {
  afiliadoId: string;
  padronId: string;
  comercioId: string;
  descripcion: string;
  importeTotal: string; // string para precisión/compat
  cantidadCuotas: number;
  periodoPrimera: string; // "YYYY-MM"
  cuotas: PreviewCuota[];
};

@Injectable()
export class OrdenesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movs: MovimientosService,
    private readonly cupo: CupoService,
  ) {}

  // ====== helpers fecha/periodo ======
  private ensureYYYYMM(periodo?: string): string {
    if (periodo && /^\d{4}-\d{2}$/.test(periodo)) return periodo;
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, '0');
    return `${yy}-${mm}`;
  }

  private addMonths(periodoYYYY_MM: string, add: number): string {
    const y = Number(periodoYYYY_MM.slice(0, 4));
    const m = Number(periodoYYYY_MM.slice(5));
    const d = new Date(y, m - 1 + add, 1);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yy}-${mm}`;
  }

  private periodoToFirstDay(periodoYYYY_MM?: string): Date {
    const p = this.ensureYYYYMM(periodoYYYY_MM);
    const y = Number(p.slice(0, 4));
    const m = Number(p.slice(5));
    // 12:00 para evitar desfasajes por TZ al serializar
    return new Date(y, m - 1, 1, 12, 0, 0, 0);
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

  // ====== helpers dinero ======
  private splitAmount(total: number, n: number): string[] {
    const base = Math.floor((total / n) * 100) / 100; // piso a 2 dec
    const arr = Array.from({ length: n }, () => base);
    const suma = base * n;
    let residuo = Math.round((total - suma) * 100); // en centavos

    let i = 0;
    while (residuo > 0 && i < n) {
      arr[i] = Math.round((arr[i] + 0.01) * 100) / 100;
      residuo -= 1;
      i++;
    }
    return arr.map((v) => v.toFixed(2));
  }

  private toBigIntOrFail(id: string, label: string): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException(`ID inválido: ${label}`);
    }
  }

  // ====== validaciones ======
  private async validarAfiliadoPadron(
    organizacionId: string,
    afiliadoIdStr: string,
    padronIdStr: string,
  ) {
    const afiliadoId = this.toBigIntOrFail(afiliadoIdStr, 'afiliadoId');
    const padronId = this.toBigIntOrFail(padronIdStr, 'padronId');

    const [afiliado, padron] = await Promise.all([
      this.prisma.afiliado.findFirst({
        where: { id: afiliadoId, organizacionId },
        select: { id: true },
      }),
      this.prisma.padron.findFirst({
        where: { id: padronId, organizacionId, activo: true },
        select: { id: true, afiliadoId: true, activo: true },
      }),
    ]);

    if (!afiliado) throw new NotFoundException('Afiliado no encontrado');
    if (!padron) throw new NotFoundException('Padrón no encontrado o inactivo');
    if (padron.afiliadoId !== afiliadoId) {
      throw new BadRequestException('El padrón no pertenece al afiliado');
    }
  }

  private async validarComercio(
    organizacionId: string,
    comercioIdStr: string,
    cantidadCuotas: number,
  ) {
    const comercioId = this.toBigIntOrFail(comercioIdStr, 'comercioId');

    const c = await this.prisma.comercio.findFirst({
      where: { id: comercioId, organizacionId, OR: [{ baja: false }, { baja: null }] },
      select: { id: true, cuoMax: true, razonSocial: true },
    });
    if (!c) throw new NotFoundException('Comercio no encontrado o dado de baja');

    if (c.cuoMax && cantidadCuotas > c.cuoMax) {
      throw new BadRequestException(`Máximo de cuotas permitido por el comercio: ${c.cuoMax}`);
    }
    return c;
  }

  // ====== PREVIEW ======
  async preview(organizacionId: string, dto: PreviewOrdenCreditoDto): Promise<PreviewResp> {
    const {
      afiliadoId,
      padronId,
      comercioId,
      descripcion = '',
      monto,
      cuotas,
      periodoPrimera,
    } = dto as any;

    if (!afiliadoId) throw new BadRequestException('Falta afiliadoId');
    if (!padronId) throw new BadRequestException('Falta padronId');
    if (!comercioId) throw new BadRequestException('Falta comercioId');

    // Normalización defensiva
    const montoNum =
      typeof monto === 'string' ? Number(String(monto).replace(',', '.')) : Number(monto);
    const cuotasNum = typeof cuotas === 'string' ? Number(cuotas) : Number(cuotas);

    if (!Number.isFinite(montoNum) || montoNum <= 0)
      throw new BadRequestException('Monto inválido.');
    if (!Number.isInteger(cuotasNum) || cuotasNum < 1)
      throw new BadRequestException('Cuotas inválidas.');

    // Validaciones de dominio
    await this.validarAfiliadoPadron(organizacionId, String(afiliadoId), String(padronId));
    await this.validarComercio(organizacionId, String(comercioId), cuotasNum);

    // (hook tasas/reglas si las hubiera)
    const recargoPct = 0;
    const total = Math.round(montoNum * (1 + recargoPct / 100) * 100) / 100;

    // Periodo de la primera cuota
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const periodo0 = this.ensureYYYYMM(periodoPrimera);

    // Partición de cuotas
    const importes = this.splitAmount(total, cuotasNum);
    const cuotasDet: PreviewCuota[] = importes.map((imp, idx) => ({
      numero: idx + 1,
      periodoVenc: this.addMonths(periodo0, idx),
      importe: imp,
    }));

    return {
      afiliadoId: String(afiliadoId),
      padronId: String(padronId),
      comercioId: String(comercioId),
      descripcion: String(descripcion ?? ''),
      importeTotal: total.toFixed(2),
      cantidadCuotas: cuotasNum,
      periodoPrimera: periodo0,
      cuotas: cuotasDet,
    };
  }

  // ====== CREAR ======
  async crearOrden(organizacionId: string, dto: CrearOrdenCreditoDto) {
    // Usamos preview (valida y normaliza)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const pv = await this.preview(organizacionId, dto as any);

    const afiliadoId = this.toBigIntOrFail(pv.afiliadoId, 'afiliadoId');
    const padronId = this.toBigIntOrFail(pv.padronId, 'padronId');
    const comercio = await this.validarComercio(organizacionId, pv.comercioId, pv.cantidadCuotas);
    const comercioId = comercio.id as unknown as bigint;

    // Validar cupo disponible antes de materializar.
    await this.cupo.asegurarCupoSuficiente(organizacionId, afiliadoId, Number(pv.importeTotal));

    const enCuotas = (dto as any).enCuotas ?? pv.cantidadCuotas > 1;

    return this.prisma.$transaction(async (tx) => {
      // Cabecera
      const orden = await tx.ordenCredito.create({
        data: {
          organizacionId,
          afiliadoId,
          padronId,
          comercioId,
          descripcion: pv.descripcion || `Orden en ${comercio.razonSocial}`,
          fechaAlta: new Date(),
          enCuotas,
          cantidadCuotas: pv.cantidadCuotas,
          cuotaActual: 1,
          importeTotal: new Prisma.Decimal(pv.importeTotal),
          saldoTotal: new Prisma.Decimal(pv.importeTotal),
          periodoPrimera: pv.periodoPrimera,
          tasaInteres: null,
          sistemaAmortizacion: null,
          preMaterializarMeses: null,
          estado: 'pendiente',
          referenciaExterna: null,
          obligacionId: null,
        } satisfies Prisma.OrdenCreditoUncheckedCreateInput,
        select: { id: true },
      });

      // ===== Materializar una Obligacion K16 por cada cuota =====
      // Cada cuota queda como Obligacion(concepto='ORDEN_CREDITO',
      // periodo=cuota.periodoVenc) cobrable por caja / débito / nómina. El
      // generador de novedades K16 las suma filtrando por período <= período
      // del lote (las cuotas futuras no se envían hasta su mes).
      const conceptoK16 = await tx.concepto.findFirst({
        where: { organizacionId, codigo: 'ORDEN_CREDITO' },
        select: { id: true },
      });
      if (!conceptoK16) {
        throw new BadRequestException(
          "Falta concepto 'ORDEN_CREDITO' en la organización. Cargalo antes de crear órdenes.",
        );
      }

      for (const c of pv.cuotas) {
        // 1) Obligación K16 de la cuota
        const obligacion = await tx.obligacion.create({
          data: {
            organizacionId,
            afiliadoId,
            padronId,
            conceptoId: conceptoK16.id,
            periodo: c.periodoVenc,
            origen: 'orden_credito',
            monto: new Prisma.Decimal(c.importe),
            saldo: new Prisma.Decimal(c.importe),
            estado: 'pendiente',
            bloqueada: false,
          },
          select: { id: true },
        });

        // 2) OrdenCreditoCuota enlazada
        await tx.ordenCreditoCuota.create({
          data: {
            ordenId: orden.id,
            comercioId,
            numero: c.numero,
            periodoVenc: c.periodoVenc,
            importe: new Prisma.Decimal(c.importe),
            cancelado: new Prisma.Decimal(0),
            saldo: new Prisma.Decimal(c.importe),
            estado: 'pendiente',
            obligacionId: obligacion.id,
            fechaGeneracionObligacion: new Date(),
            fechaCancelacion: null,
          },
        });

        // 3) Movimiento débito en cuenta corriente
        const periodoContable = this.normalizarPeriodo(c.periodoVenc);
        await this.movs.postMovimiento({
          tx: tx as unknown as PrismaClient,
          organizacionId,
          afiliadoId,
          padronId,
          fecha: new Date(),
          periodoContable,
          naturaleza: 'debito',
          origen: 'orden_credito',
          concepto: `ORD#${orden.id.toString()} cuota ${c.numero}/${pv.cantidadCuotas} (${c.periodoVenc}) - ${comercio.razonSocial}`,
          importe: c.importe,
          ordenId: orden.id,
          obligacionId: obligacion.id,
        });
      }

      // devolver orden + cuotas
      const creada = await tx.ordenCredito.findUnique({
        where: { id: orden.id },
        include: { cuotas: { orderBy: { numero: 'asc' } } },
      });
      return creada!;
    });
  }

  // ====== DETALLES DE PAGOS DE UNA ORDEN ======
  async detallesPagosOrden(organizacionId: string, ordenIdNum: number) {
    const ordenId = BigInt(ordenIdNum);
    
    const orden = await this.prisma.ordenCredito.findUnique({
      where: {
        id: ordenId,
        organizacionId,
      },
      include: {
        cuotas: {
          orderBy: { numero: 'asc' },
        },
      },
    });

    if (!orden) throw new NotFoundException('Orden no encontrada');

    // Obtener IDs de todas las cuotas
    const cuotaIds = orden.cuotas.map((c) => c.id);
    
    // Obtener movimientos de crédito (pagos) para todas las cuotas
    // Incluye pagos de caja y pagos de nómina (descuentos K16)
    const movimientos = cuotaIds.length > 0
      ? await this.prisma.movimientoAfiliado.findMany({
          where: {
            organizacionId,
            cuotaId: { in: cuotaIds },
            naturaleza: 'credito',
            origen: { in: ['pago_caja', 'nomina'] },
          },
          select: {
            id: true,
            fecha: true,
            importe: true,
            concepto: true,
            cuotaId: true,
            pagoId: true,
            origen: true,
            periodoContable: true,
          },
          orderBy: { fecha: 'asc' },
        })
      : [];

    // Obtener pagos únicos para obtener sus fechas y totales
    const pagoIds = [...new Set(movimientos.filter((m) => m.pagoId).map((m) => m.pagoId!))];
    const pagosMap = pagoIds.length > 0
      ? new Map(
          (await this.prisma.pago.findMany({
            where: { id: { in: pagoIds } },
            select: { id: true, fecha: true, total: true },
          })).map((p) => [p.id.toString(), p])
        )
      : new Map();

    // Formatear respuesta con detalles de pagos por cuota
    const cuotasConDetalles = orden.cuotas.map((cuota) => {
      const movimientosCuota = movimientos.filter((m) => m.cuotaId?.toString() === cuota.id.toString());
      const pagos = movimientosCuota.map((mov) => {
        const pago = mov.pagoId ? pagosMap.get(mov.pagoId.toString()) : null;
        return {
          id: mov.id.toString(),
          fecha: mov.fecha,
          importe: Number(mov.importe),
          concepto: mov.concepto,
          pagoId: mov.pagoId?.toString(),
          pagoFecha: pago?.fecha,
          pagoTotal: pago ? Number(pago.total) : null,
          origen: mov.origen, // 'pago_caja' o 'nomina'
          periodoContable: mov.periodoContable, // Para nómina: período al que corresponde
        };
      });

      const totalPagado = pagos.reduce((sum, p) => sum + p.importe, 0);
      const porcentajePagado = cuota.importe ? (totalPagado / Number(cuota.importe)) * 100 : 0;
      const estado = Number(cuota.saldo) <= 0.01 
        ? 'pagada' 
        : totalPagado > 0 
        ? 'parcialmente_pagada' 
        : 'pendiente';

      return {
        id: cuota.id.toString(),
        numero: cuota.numero,
        periodoVenc: cuota.periodoVenc,
        importe: Number(cuota.importe),
        cancelado: Number(cuota.cancelado),
        saldo: Number(cuota.saldo),
        estado: cuota.estado,
        totalPagado,
        porcentajePagado,
        estadoCalculado: estado,
        pagos,
      };
    });

    const totalOrden = Number(orden.importeTotal);
    const totalPagadoOrden = cuotasConDetalles.reduce((sum, c) => sum + c.totalPagado, 0);
    const porcentajePagadoOrden = totalOrden > 0 ? (totalPagadoOrden / totalOrden) * 100 : 0;

    return {
      orden: {
        id: orden.id.toString(),
        descripcion: orden.descripcion,
        fechaAlta: orden.fechaAlta,
        importeTotal: totalOrden,
        saldoTotal: Number(orden.saldoTotal),
        cantidadCuotas: orden.cantidadCuotas,
        estado: orden.estado,
        totalPagado: totalPagadoOrden,
        porcentajePagado: porcentajePagadoOrden,
      },
      cuotas: cuotasConDetalles,
    };
  }

  // ====== LISTAR ======
  async listarPorAfiliado(organizacionId: string, afiliadoIdNum: number) {
    const afiliadoId = BigInt(afiliadoIdNum);
    return this.prisma.ordenCredito.findMany({
      where: { organizacionId, afiliadoId },
      orderBy: { id: 'desc' },
      include: { cuotas: { orderBy: { numero: 'asc' } } },
    });
  }

  // ====== DETALLE CON PAGOS ======
  /**
   * Obtiene el detalle completo de una orden incluyendo todos los pagos realizados
   * para cada cuota, permitiendo ver el historial de pagos parciales y completos.
   */
  async detalleOrdenConPagos(organizacionId: string, ordenId: bigint) {
    const orden = await this.prisma.ordenCredito.findUnique({
      where: {
        id: ordenId,
        organizacionId,
      },
      include: {
        cuotas: {
          orderBy: { numero: 'asc' },
        },
        comercio: {
          select: {
            razonSocial: true,
          },
        },
      },
    });

    if (!orden) throw new NotFoundException('Orden no encontrada');

    // Obtener movimientos de crédito (pagos) para todas las cuotas de esta orden
    const cuotaIds = orden.cuotas.map((c) => c.id);
    const movimientos = cuotaIds.length > 0
      ? await this.prisma.movimientoAfiliado.findMany({
          where: {
            organizacionId,
            cuotaId: { in: cuotaIds },
            naturaleza: 'credito', // Solo pagos (créditos)
            origen: 'pago_caja',
          },
          select: {
            id: true,
            fecha: true,
            importe: true,
            concepto: true,
            cuotaId: true,
            pagoId: true,
          },
          orderBy: { fecha: 'asc' },
        })
      : [];

    // Obtener pagos únicos
    const pagoIds = [...new Set(movimientos.filter((m) => m.pagoId).map((m) => m.pagoId!))];
    const pagos = pagoIds.length > 0
      ? await this.prisma.pago.findMany({
          where: { id: { in: pagoIds } },
          include: {
            metodos: {
              select: {
                metodo: true,
                monto: true,
              },
            },
          },
        })
      : [];
    const mapaPagos = new Map(pagos.map((p) => [p.id.toString(), p]));

    // Agrupar movimientos por cuotaId
    const movimientosPorCuota = new Map<string, typeof movimientos>();
    for (const mov of movimientos) {
      if (mov.cuotaId) {
        const key = mov.cuotaId.toString();
        if (!movimientosPorCuota.has(key)) {
          movimientosPorCuota.set(key, []);
        }
        movimientosPorCuota.get(key)!.push(mov);
      }
    }

    // Enriquecer cuotas con información de pagos
    const cuotasConPagos = orden.cuotas.map((cuota) => {
      const movs = movimientosPorCuota.get(cuota.id.toString()) || [];
      const pagosCuota = movs.map((mov) => {
        const pago = mov.pagoId ? mapaPagos.get(mov.pagoId.toString()) : null;
        return {
          movimientoId: mov.id.toString(),
          fecha: mov.fecha,
          importe: Number(mov.importe),
          concepto: mov.concepto,
          pago: pago
            ? {
                id: pago.id.toString(),
                fecha: pago.fecha,
                total: Number(pago.total),
                metodos: pago.metodos.map((m) => ({
                  metodo: m.metodo,
                  monto: Number(m.monto),
                })),
              }
            : null,
        };
      });

      const totalPagado = pagosCuota.reduce((sum, p) => sum + p.importe, 0);
      const porcentajePagado = Number(cuota.importe) > 0 
        ? (totalPagado / Number(cuota.importe)) * 100 
        : 0;

      return {
        ...cuota,
        importe: Number(cuota.importe),
        cancelado: Number(cuota.cancelado),
        saldo: Number(cuota.saldo),
        pagos: pagosCuota,
        totalPagado,
        porcentajePagado: Math.round(porcentajePagado * 100) / 100,
        estadoPago: 
          Number(cuota.saldo) <= 0.01 ? 'pagada' :
          totalPagado > 0 ? 'parcialmente_pagada' :
          'pendiente',
      };
    });

    const totalOrden = Number(orden.importeTotal);
    const totalPagadoOrden = cuotasConPagos.reduce((sum, c) => sum + c.totalPagado, 0);
    const porcentajePagadoOrden = totalOrden > 0 
      ? (totalPagadoOrden / totalOrden) * 100 
      : 0;

    return {
      ...orden,
      importeTotal: totalOrden,
      saldoTotal: Number(orden.saldoTotal),
      cuotas: cuotasConPagos,
      resumen: {
        totalOrden,
        totalPagado: totalPagadoOrden,
        saldoPendiente: Number(orden.saldoTotal),
        porcentajePagado: Math.round(porcentajePagadoOrden * 100) / 100,
        estadoGeneral: 
          Number(orden.saldoTotal) <= 0.01 ? 'cancelada' :
          totalPagadoOrden > 0 ? 'en_curso' :
          'pendiente',
      },
    };
  }
}
