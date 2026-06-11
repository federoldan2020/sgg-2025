// src/modulos/movimientos/movimientos.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma.service';

type Moneda = 'ARS' | 'USD';

type PostParams = {
  tx?: Prisma.TransactionClient; // <- TransactionClient
  organizacionId: string;
  afiliadoId: bigint;
  padronId?: bigint | null;
  fecha?: Date;
  naturaleza: 'debito' | 'credito';
  origen: 'orden_credito' | 'cuota' | 'pago_caja' | 'nomina' | 'ajuste' | 'anulacion';
  concepto: string;

  /** Si trabajás en ARS, pasá `importe`. Si es USD, podés omitir `importe` y pasar (moneda, importeMoneda, tcAplicado). */
  importe?: number | string; // ARS base (opcional si usás moneda extranjera)
  moneda?: Moneda; // traza opcional de moneda original
  importeMoneda?: number | string; // en la moneda original
  tcAplicado?: number | string; // TC usado para convertir a ARS

  // trazas opcionales
  obligacionId?: bigint | null;
  ordenId?: bigint | null;
  cuotaId?: bigint | null;
  pagoId?: bigint | null;
  
  // Período contable: formato "YYYY-MM" para agrupar movimientos por período
  periodoContable?: string | null;

  /**
   * Si false, el movimiento se registra pero NO afecta el saldo del padrón.
   * Útil para J17, J22, J38 que son descuentos informativos (no hay deuda previa registrada).
   * Default: true
   */
  afectaSaldo?: boolean;

  // contabilidad (opcional)
  asiento?: {
    descripcion: string;
    referenciaId?: string;
    // mapeo
    conceptoCodigo?: string | null;
    metodoPago?: string | null;
    /** Para elegir mapeo por moneda (si tu CuentaMapeo lo soporta) y dejar traza en Asiento */
    moneda?: Moneda | null;
    tc?: number | string | null;
  };
};

@Injectable()
export class MovimientosService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== helpers num/decimal =====
  private toNum(n: number | string | undefined | null, def = 0) {
    const v = n == null ? def : Number(n);
    return Number.isFinite(v) ? v : def;
  }
  private dec(n: number | string) {
    return new Prisma.Decimal(n);
  }

  /**
   * Crea el movimiento (submayor afiliado) y, opcionalmente, el asiento contable.
   * Soporta ARS directo o USD con TC -> convierte a ARS para saldo/asiento.
   * - Si viene `tx`, NO abre nueva transacción.
   * - Si no viene `tx`, abre `this.prisma.$transaction`.
   */
  async postMovimiento(p: PostParams) {
    const fecha = p.fecha ?? new Date();

    // ===== 1) Determinar importe en ARS (base contable) =====
    let importeArs: number | undefined = undefined;

    if (p.importe != null) {
      // Ruta clásica: ya viene en ARS
      importeArs = this.toNum(p.importe);
    } else if (p.moneda && p.moneda !== 'ARS') {
      // Ruta FX: USD => ARS
      const im = this.toNum(p.importeMoneda);
      const tc = this.toNum(p.tcAplicado);
      if (!im || !tc) {
        throw new BadRequestException(
          'Para moneda extranjera indicá importeMoneda y tcAplicado (> 0).',
        );
      }
      importeArs = im * tc;
    }

    if (!importeArs || !Number.isFinite(importeArs) || importeArs <= 0) {
      throw new BadRequestException('Importe inválido (> 0).');
    }

    // Por defecto, los movimientos afectan el saldo
    const afectaSaldo = p.afectaSaldo !== false;

    const run = async (tx: Prisma.TransactionClient) => {
      // ===== 2) Último saldo (para saldoPosterior) =====
      // El saldo es POR PADRÓN, así que filtramos por padronId si está presente
      const whereLastMov: Prisma.MovimientoAfiliadoWhereInput = {
        organizacionId: p.organizacionId,
        afiliadoId: p.afiliadoId,
      };
      
      // Si el movimiento tiene padronId, buscar saldo de ese padrón específico
      // Si no tiene, buscar movimientos sin padrón (padronId = null)
      if (p.padronId) {
        whereLastMov.padronId = p.padronId;
      } else {
        whereLastMov.padronId = null;
      }
      
      const last = await tx.movimientoAfiliado.findFirst({
        where: whereLastMov,
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        select: { saldoPosterior: true },
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const prevSaldo = this.toNum(last?.saldoPosterior as any, 0);
      
      // Si afectaSaldo = false, el movimiento NO modifica el saldo (es solo informativo)
      // Útil para J17, J22, J38 que son descuentos sin deuda previa registrada
      const delta = afectaSaldo ? (importeArs * (p.naturaleza === 'credito' ? -1 : 1)) : 0;
      const nuevoSaldo = prevSaldo + delta;

      // ===== 3) Asiento opcional =====
      let asientoId: bigint | null = null;

      if (p.asiento) {
        // Si vas a discriminar por moneda en CuentaMapeo, este campo debe existir en el schema:
        //   moneda Moneda?  (null = aplica a cualquier)
        const mapeo = await tx.cuentaMapeo.findFirst({
          where: {
            organizacionId: p.organizacionId,
            origen: p.origen,
            activo: true,
            conceptoCodigo: p.asiento.conceptoCodigo ?? null,
            metodoPago: p.asiento.metodoPago ?? null,
            // Si tu schema NO tiene "moneda" en CuentaMapeo, remové esta línea:
            moneda: (p.asiento.moneda as any) ?? null,
          },
          select: { debeCodigo: true, haberCodigo: true },
        });

        if (!mapeo) {
          throw new BadRequestException(
            `CuentaMapeo faltante para origen=${p.origen} concepto=${p.asiento.conceptoCodigo ?? '-'} metodo=${p.asiento.metodoPago ?? '-'} moneda=${p.asiento.moneda ?? '-'}`,
          );
        }

        const asiento = await tx.asiento.create({
          data: {
            organizacionId: p.organizacionId,
            fecha,
            origen: p.origen,
            descripcion: p.asiento.descripcion,
            referenciaId: p.asiento.referenciaId ?? null,
            // Si agregaste metadata en Asiento:
            // moneda: (p.asiento.moneda as any) ?? null,
            // tc: p.asiento.tc != null ? this.dec(p.asiento.tc) : null,
            lineas: {
              create: [
                { cuenta: mapeo.debeCodigo, debe: this.dec(importeArs), haber: this.dec(0) },
                { cuenta: mapeo.haberCodigo, debe: this.dec(0), haber: this.dec(importeArs) },
              ],
            },
          },
          select: { id: true },
        });
        asientoId = asiento.id as unknown as bigint;
      }

      // ===== 4) Movimiento submayor afiliado (con traza FX si aplica) =====
      const mov = await tx.movimientoAfiliado.create({
        data: {
          organizacionId: p.organizacionId,
          afiliadoId: p.afiliadoId,
          padronId: p.padronId ?? null,
          fecha,
          naturaleza: p.naturaleza === 'credito' ? 'credito' : 'debito',
          origen: p.origen,
          concepto: p.concepto,
          importe: this.dec(importeArs), // ARS
          // FX (opcional; si tu tabla los tiene)
          moneda: (p.moneda as any) ?? null,
          importeMoneda: p.importeMoneda != null ? this.dec(p.importeMoneda) : null,
          tcAplicado: p.tcAplicado != null ? this.dec(p.tcAplicado) : null,

          // vínculos
          obligacionId: p.obligacionId ?? null,
          ordenId: p.ordenId ?? null,
          cuotaId: p.cuotaId ?? null,
          pagoId: p.pagoId ?? null,
          
          // Período contable para agrupar por período cuando corresponde
          periodoContable: p.periodoContable ?? null,

          saldoPosterior: this.dec(nuevoSaldo),
          asientoId,
        },
      });

      // ===== 5) Refrescar saldo “rápido” en Afiliado =====
      await tx.afiliado.update({
        where: { id: p.afiliadoId },
        data: { saldo: this.dec(nuevoSaldo) },
      });

      return mov;
    };

    if (p.tx) return run(p.tx);
    return this.prisma.$transaction(run);
  }

  /**
   * Lista la cuenta corriente del afiliado.
   * 
   * REGLAS SIMPLIFICADAS:
   * - Descuentos de nómina: se filtran por periodoContable (el mes al que corresponden)
   * - Pagos de caja: se filtran por fecha física
   * - Órdenes de crédito: se filtran por periodoContable (período de vencimiento de la cuota)
   * - Saldo final: SIEMPRE es el acumulado global (deuda total real)
   */
  async listarCtaCte(
    organizacionId: string,
    afiliadoId: bigint,
    desde?: Date,
    hasta?: Date,
    take = 200,
    padronId?: bigint | null,
    periodoContable?: string | null, // Formato "YYYY-MM"
  ) {
    // Ajustar fechas para incluir todo el día
    let desdeAjustado: Date | undefined;
    let hastaAjustado: Date | undefined;
    
    if (desde) {
      desdeAjustado = new Date(desde);
      desdeAjustado.setHours(0, 0, 0, 0);
    }
    
    if (hasta) {
      hastaAjustado = new Date(hasta);
      hastaAjustado.setHours(23, 59, 59, 999);
    }

    // Construir filtro base
    // Si se especifica padronId, mostrar SOLO movimientos de ese padrón
    const baseWhere: Prisma.MovimientoAfiliadoWhereInput = {
      organizacionId,
      afiliadoId,
      ...(padronId !== undefined && padronId !== null ? { padronId } : {}),
    };

    // Construir condiciones de filtrado por período/fecha
    // Un movimiento se muestra si:
    // 1. Tiene periodoContable = mes seleccionado (descuentos nómina, débitos orden)
    // 2. O tiene fecha física en el mes y NO tiene periodoContable (pagos caja)
    const condiciones: Prisma.MovimientoAfiliadoWhereInput[] = [];
    
    if (periodoContable) {
      // Movimientos con período contable = mes seleccionado
      condiciones.push({ periodoContable });
      
      // Movimientos sin período contable pero con fecha física en el rango
      if (desdeAjustado && hastaAjustado) {
        condiciones.push({
          periodoContable: null,
          fecha: { gte: desdeAjustado, lte: hastaAjustado },
        });
      }
    } else if (desdeAjustado || hastaAjustado) {
      // Sin período contable: filtrar solo por fecha física
      condiciones.push({
        fecha: { 
          ...(desdeAjustado ? { gte: desdeAjustado } : {}), 
          ...(hastaAjustado ? { lte: hastaAjustado } : {}) 
        }
      });
    }

    const where: Prisma.MovimientoAfiliadoWhereInput = {
      ...baseWhere,
      ...(condiciones.length > 0 ? { OR: condiciones } : {}),
    };

    // Buscar movimientos
    const rows = await this.prisma.movimientoAfiliado.findMany({
      where,
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
      take,
    });

    // Obtener IDs para enriquecer con saldos actuales
    const cuotaIds = [...new Set(rows.filter((m) => m.cuotaId).map((m) => m.cuotaId!))];
    const ordenIds = [...new Set(rows.filter((m) => m.ordenId).map((m) => m.ordenId!))];
    const obligacionIds = [
      ...new Set(rows.filter((m) => m.obligacionId).map((m) => m.obligacionId!)),
    ];

    // Consultar saldos actuales
    const cuotas = cuotaIds.length > 0
      ? await this.prisma.ordenCreditoCuota.findMany({
          where: { id: { in: cuotaIds } },
          select: { id: true, saldo: true },
        })
      : [];
    
    const ordenes = ordenIds.length > 0
      ? await this.prisma.ordenCredito.findMany({
          where: { id: { in: ordenIds } },
          select: { id: true, saldoTotal: true },
        })
      : [];

    const obligaciones =
      obligacionIds.length > 0
        ? await this.prisma.obligacion.findMany({
            where: { id: { in: obligacionIds } },
            select: { id: true, saldo: true },
          })
        : [];

    const mapaCuotas = new Map(cuotas.map((c) => [c.id.toString(), c]));
    const mapaOrdenes = new Map(ordenes.map((o) => [o.id.toString(), o]));
    const mapaObligaciones = new Map(obligaciones.map((o) => [o.id.toString(), o]));

    // Enriquecer movimientos con saldo pendiente actual
    const movimientos = rows.map((mov) => {
      let saldoPendiente: number | null = null;
      
      // Solo mostrar saldo pendiente para débitos vinculados a órdenes/cuotas
      if (mov.naturaleza === 'debito') {
        if (mov.cuotaId) {
          const cuota = mapaCuotas.get(mov.cuotaId.toString());
          if (cuota) saldoPendiente = Number(cuota.saldo || 0);
        } else if (mov.ordenId) {
          const orden = mapaOrdenes.get(mov.ordenId.toString());
          if (orden) saldoPendiente = Number(orden.saldoTotal || 0);
        } else if (mov.obligacionId) {
          const ob = mapaObligaciones.get(mov.obligacionId.toString());
          if (ob) saldoPendiente = Number(ob.saldo || 0);
        }
      }

      return { ...mov, saldoPendiente };
    });

    // SALDO FINAL = deuda total acumulada del padrón = suma(débito) − suma(crédito).
    // Robusto: no depende de saldoPosterior (que no todos los orígenes setean,
    // p. ej. cobranza por nómina u obligaciones sembradas).
    const sumas = await this.prisma.movimientoAfiliado.groupBy({
      by: ['naturaleza'],
      where: baseWhere,
      _sum: { importe: true },
    });
    let totalDebito = 0;
    let totalCredito = 0;
    for (const s of sumas) {
      const v = Number(s._sum.importe || 0);
      if (s.naturaleza === 'debito') totalDebito = v;
      else totalCredito = v;
    }
    const saldoFinal = totalDebito - totalCredito;

    return { movimientos, saldoFinal };
  }

  /**
   * ⚠️ PELIGROSO: Limpia TODOS los movimientos y resetea saldos relacionados.
   * Solo usar en desarrollo/testing.
   */
  async limpiarTodos(organizacionId?: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Borrar todos los movimientos (opcionalmente filtrado por organización)
        const where = organizacionId ? { organizacionId } : {};
        const deleted = await tx.movimientoAfiliado.deleteMany({ where });

      // 2. Resetear saldos de afiliados
      const afiliadosWhere = organizacionId ? { organizacionId } : {};
      await tx.afiliado.updateMany({
        where: afiliadosWhere,
        data: { saldo: this.dec(0) },
      });

      // 3. Resetear saldos de órdenes de crédito
      const ordenesWhere: any = organizacionId ? { organizacionId } : {};
      const ordenes = await tx.ordenCredito.findMany({
        where: ordenesWhere,
        select: { id: true, importeTotal: true, estado: true },
      });

      let ordenesActualizadas = 0;
      for (const orden of ordenes) {
        // Mantener estado 'anulada' si existe, sino resetear a 'pendiente'
        const nuevoEstado = orden.estado === 'anulada' ? 'anulada' : 'pendiente';
        await tx.ordenCredito.update({
          where: { id: orden.id },
          data: {
            saldoTotal: orden.importeTotal,
            estado: nuevoEstado,
          },
        });
        ordenesActualizadas++;
      }

      // 4. Resetear saldos de cuotas
      const ordenIds = ordenes.map((o) => o.id);
      const cuotas = ordenIds.length > 0
        ? await tx.ordenCreditoCuota.findMany({
            where: {
              ordenId: { in: ordenIds },
            },
            select: { id: true, importe: true, estado: true },
          })
        : [];

      let cuotasActualizadas = 0;
      for (const cuota of cuotas) {
        // Mantener estado 'anulada' si existe, sino resetear a 'pendiente'
        const nuevoEstado = cuota.estado === 'anulada' ? 'anulada' : 'pendiente';
        await tx.ordenCreditoCuota.update({
          where: { id: cuota.id },
          data: {
            saldo: cuota.importe,
            cancelado: this.dec(0),
            estado: nuevoEstado,
          },
        });
        cuotasActualizadas++;
      }

      // 5. Resetear saldos de obligaciones
      const obligacionesWhere: any = organizacionId ? { organizacionId } : {};
      const obligaciones = await tx.obligacion.findMany({
        where: obligacionesWhere,
        select: { id: true, monto: true, estado: true },
      });

      let obligacionesActualizadas = 0;
      for (const obl of obligaciones) {
        // Mantener estado 'anulada' si existe, sino resetear a 'pendiente'
        const nuevoEstado = obl.estado === 'anulada' ? 'anulada' : 'pendiente';
        await tx.obligacion.update({
          where: { id: obl.id },
          data: {
            saldo: obl.monto,
            estado: nuevoEstado,
          },
        });
        obligacionesActualizadas++;
      }

      return {
        mensaje: 'Limpieza completada',
        movimientosBorrados: deleted.count,
        ordenesReseteadas: ordenesActualizadas,
        cuotasReseteadas: cuotasActualizadas,
        obligacionesReseteadas: obligacionesActualizadas,
      };
      },
      { maxWait: 120000, timeout: 120000 } // 2 minutos de timeout
    );
  }

  /**
   * Reversa simple: genera un movimiento inverso (y asiento inverso si corresponde).
   */
  async reversar(id: bigint, motivo = 'Reversión') {
    const original = await this.prisma.movimientoAfiliado.findUnique({ where: { id } });
    if (!original) throw new BadRequestException('Movimiento inexistente');

    return this.postMovimiento({
      organizacionId: original.organizacionId,
      afiliadoId: original.afiliadoId,
      padronId: original.padronId ?? undefined,
      naturaleza: original.naturaleza === 'debito' ? 'credito' : 'debito',
      origen: 'anulacion',
      concepto: motivo,
      importe: Number(original.importe), // ARS
      moneda: (original as any).moneda ?? undefined,
      importeMoneda: (original as any).importeMoneda ?? undefined,
      tcAplicado: (original as any).tcAplicado ?? undefined,

      obligacionId: original.obligacionId ?? undefined,
      ordenId: original.ordenId ?? undefined,
      cuotaId: original.cuotaId ?? undefined,
      pagoId: original.pagoId ?? undefined,

      asiento: original.asientoId
        ? {
            descripcion: `Reversa de asiento ${original.asientoId.toString()}`,
            referenciaId: original.asientoId.toString(),
            // moneda: (original as any).moneda ?? null,
            // tc: (original as any).tcAplicado ?? null,
          }
        : undefined,
    });
  }
}
