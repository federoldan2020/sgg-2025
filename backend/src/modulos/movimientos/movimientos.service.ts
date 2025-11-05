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

    const run = async (tx: Prisma.TransactionClient) => {
      // ===== 2) Último saldo (para saldoPosterior) =====
      const last = await tx.movimientoAfiliado.findFirst({
        where: { organizacionId: p.organizacionId, afiliadoId: p.afiliadoId },
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        select: { saldoPosterior: true },
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const prevSaldo = this.toNum(last?.saldoPosterior as any, 0);
      const delta = importeArs * (p.naturaleza === 'credito' ? -1 : 1);
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
   * Lista la cta. cte. (ordenada) y devuelve saldo final observado.
   */
  async listarCtaCte(
    organizacionId: string,
    afiliadoId: bigint,
    desde?: Date,
    hasta?: Date,
    take = 200,
    padronId?: bigint | null, // <- opcional
  ) {
    const where: Prisma.MovimientoAfiliadoWhereInput = {
      organizacionId,
      afiliadoId,
      ...(padronId ? { padronId } : {}),
      ...(desde || hasta
        ? { fecha: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
        : {}),
    };

    const rows = await this.prisma.movimientoAfiliado.findMany({
      where,
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
      take,
    });

    const saldoFinal = rows.length ? Number(rows[rows.length - 1].saldoPosterior ?? 0) : 0;
    return { movimientos: rows, saldoFinal };
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
