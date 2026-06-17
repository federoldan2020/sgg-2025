/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { ParametrosService } from './parametros.service';
import { calcularJ38ParaAfiliado } from '../colaterales/colaterales-precio.util';

/**
 * Materialización mensual de Obligaciones (decisiones 19-23 del modelo).
 *
 * El último día hábil del mes M-1, el sistema corre `materializarExAnte`
 * para crear las obligaciones del mes M que tienen monto cierto a priori:
 *
 *   - J22 (coseguro): por cada afiliado con CoseguroAfiliado.estado='activo'
 *   - J38 (colaterales): por cada afiliado con colaterales activos
 *   - J17 (sólo 04): por cada padrón con situación='04' y activo=true
 *
 * J17 de Activos/Jub/PP NO se materializa ex-ante (no conocemos el monto a
 * priori; se materializa la diferencia contra mínimo al cierre del día 10).
 *
 * El servicio es **idempotente**: si la obligación ya existe (por
 * afiliado/padrón + concepto + período) NO la duplica.
 */

const CODIGO_CONCEPTO = {
  J17: 'CUOTA_SOC',
  J22: 'COSEGURO',
  J38: 'ADIC_COL',
  K16: 'ORDEN_CREDITO',
} as const;

const PERIODO_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export type ResumenMaterializacion = {
  organizacionId: string;
  periodo: string;
  dryRun: boolean;
  vencimiento: string; // ISO date
  j22: {
    afiliadosConsiderados: number;
    creadas: number;
    yaExistentes: number;
    sinReglaVigente: number;
    montoTotal: number;
  };
  j38: {
    afiliadosConsiderados: number;
    creadas: number;
    yaExistentes: number;
    sinReglaVigente: number;
    montoTotal: number;
  };
  j17_04: {
    padronesConsiderados: number;
    creadas: number;
    yaExistentes: number;
    sinParametro: number;
    montoTotal: number;
  };
};

function periodoToFecha(periodo: string): Date {
  const [y, m] = periodo.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

@Injectable()
export class ObligacionesMensualesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly parametros: ParametrosService,
  ) {}

  /**
   * Materializa obligaciones ex-ante para el período indicado.
   * @param dryRun si true, calcula todo pero NO escribe.
   */
  async materializarExAnte(opts: {
    organizacionId: string;
    periodo: string;
    dryRun?: boolean;
    usuarioId?: string;
  }): Promise<ResumenMaterializacion> {
    const { organizacionId, periodo, dryRun = false, usuarioId } = opts;

    if (!PERIODO_REGEX.test(periodo)) {
      throw new BadRequestException(`Periodo inválido: ${periodo} (esperado YYYY-MM)`);
    }

    const fechaPeriodo = periodoToFecha(periodo);
    // Vencimiento: día 10 del período objetivo.
    const [y, m] = periodo.split('-').map(Number);
    const vencimiento = new Date(Date.UTC(y, m - 1, 10, 23, 59, 59));

    // Resolver Conceptos en BD (necesarios para crear Obligaciones).
    const conceptos = await this.prisma.concepto.findMany({
      where: {
        organizacionId,
        codigo: { in: Object.values(CODIGO_CONCEPTO) },
      },
      select: { id: true, codigo: true },
    });
    const mapaConcepto = new Map(conceptos.map((c) => [c.codigo, c.id]));
    const conceptoJ22 = mapaConcepto.get(CODIGO_CONCEPTO.J22);
    const conceptoJ38 = mapaConcepto.get(CODIGO_CONCEPTO.J38);
    const conceptoJ17 = mapaConcepto.get(CODIGO_CONCEPTO.J17);

    if (!conceptoJ22 || !conceptoJ38 || !conceptoJ17) {
      throw new BadRequestException(
        `Faltan conceptos base en la organización. Esperados: ${Object.values(CODIGO_CONCEPTO).join(', ')}`,
      );
    }

    const resumen: ResumenMaterializacion = {
      organizacionId,
      periodo,
      dryRun,
      vencimiento: vencimiento.toISOString(),
      j22: { afiliadosConsiderados: 0, creadas: 0, yaExistentes: 0, sinReglaVigente: 0, montoTotal: 0 },
      j38: { afiliadosConsiderados: 0, creadas: 0, yaExistentes: 0, sinReglaVigente: 0, montoTotal: 0 },
      j17_04: { padronesConsiderados: 0, creadas: 0, yaExistentes: 0, sinParametro: 0, montoTotal: 0 },
    };

    // --------------------- J22 + J38 (afiliados con coseguro) ---------------------
    const reglaJ22 = await this.prisma.reglaPrecioCoseguro.findFirst({
      where: {
        organizacionId,
        activo: true,
        vigenteDesde: { lte: fechaPeriodo },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaPeriodo } }],
      },
      orderBy: { vigenteDesde: 'desc' },
    });
    const valorJ22 = reglaJ22 ? Number(reglaJ22.precioBase) : 0;

    const coseguros = await this.prisma.coseguroAfiliado.findMany({
      where: { organizacionId, estado: 'activo' },
      include: {
        afiliado: {
          select: {
            id: true,
            padrones: {
              where: { activo: true },
              select: { id: true },
              orderBy: { id: 'asc' },
              take: 1,
            },
            Colateral: { where: { activo: true }, select: { id: true } },
          },
        },
      },
    });

    const obligacionesACrear: any[] = [];

    for (const cs of coseguros) {
      resumen.j22.afiliadosConsiderados++;
      // J22: una obligación por afiliado.
      if (valorJ22 <= 0) {
        resumen.j22.sinReglaVigente++;
      } else {
        const yaExiste = await this.existeObligacion(
          organizacionId,
          cs.afiliadoId,
          conceptoJ22,
          periodo,
        );
        if (yaExiste) {
          resumen.j22.yaExistentes++;
        } else {
          obligacionesACrear.push({
            organizacionId,
            afiliadoId: cs.afiliadoId,
            // Padrón de imputación (uno cualquiera del afiliado): para reporting.
            padronId:
              cs.imputacionPadronIdCoseguro ??
              cs.afiliado.padrones[0]?.id ??
              null,
            conceptoId: conceptoJ22,
            periodo,
            origen: 'materializacion_mensual',
            monto: valorJ22,
            saldo: valorJ22,
            estado: 'pendiente',
            bloqueada: false,
          });
          resumen.j22.creadas++;
          resumen.j22.montoTotal += valorJ22;
        }
      }

      // J38: una obligación por afiliado si tiene colaterales activos.
      const cantidadColaterales = cs.afiliado.Colateral.length;
      if (cantidadColaterales > 0) {
        resumen.j38.afiliadosConsiderados++;
        const totalJ38 = await calcularJ38ParaAfiliado(
          this.prisma,
          organizacionId,
          BigInt(cs.afiliadoId),
          fechaPeriodo,
        );
        const valorJ38 = Number(totalJ38);

        if (valorJ38 <= 0) {
          resumen.j38.sinReglaVigente++;
        } else {
          const yaExiste = await this.existeObligacion(
            organizacionId,
            cs.afiliadoId,
            conceptoJ38,
            periodo,
          );
          if (yaExiste) {
            resumen.j38.yaExistentes++;
          } else {
            obligacionesACrear.push({
              organizacionId,
              afiliadoId: cs.afiliadoId,
              padronId:
                cs.imputacionPadronIdColaterales ??
                cs.afiliado.padrones[0]?.id ??
                null,
              conceptoId: conceptoJ38,
              periodo,
              origen: 'materializacion_mensual',
              monto: valorJ38,
              saldo: valorJ38,
              estado: 'pendiente',
              bloqueada: false,
            });
            resumen.j38.creadas++;
            resumen.j38.montoTotal += valorJ38;
          }
        }
      }
    }

    // --------------------- J17 para 04 ---------------------
    const param04 = await this.parametros.getVigente(organizacionId, fechaPeriodo, 'J17_CUOTA_04');
    const valor04 = param04?.valor ?? 0;

    const padrones04 = await this.prisma.padron.findMany({
      where: { organizacionId, activo: true, situacion: '04' },
      select: { id: true, afiliadoId: true },
    });

    for (const p of padrones04) {
      resumen.j17_04.padronesConsiderados++;
      if (valor04 <= 0) {
        resumen.j17_04.sinParametro++;
        continue;
      }
      // Para 04 la obligación es por padrón (puede haber afiliados con varios padrones,
      // aunque es raro en 04). Identificamos por (afiliado, padrón, concepto, periodo).
      const yaExiste = await this.prisma.obligacion.findFirst({
        where: {
          organizacionId,
          afiliadoId: p.afiliadoId,
          padronId: p.id,
          conceptoId: conceptoJ17,
          periodo,
        },
        select: { id: true },
      });
      if (yaExiste) {
        resumen.j17_04.yaExistentes++;
      } else {
        obligacionesACrear.push({
          organizacionId,
          afiliadoId: p.afiliadoId,
          padronId: p.id,
          conceptoId: conceptoJ17,
          periodo,
          origen: 'materializacion_mensual',
          monto: valor04,
          saldo: valor04,
          estado: 'pendiente',
          bloqueada: false,
        });
        resumen.j17_04.creadas++;
        resumen.j17_04.montoTotal += valor04;
      }
    }

    // --------------------- Persistir ---------------------
    if (!dryRun) {
      // 1) Crear las obligaciones nuevas en lote.
      if (obligacionesACrear.length > 0) {
        const CHUNK = 200;
        for (let i = 0; i < obligacionesACrear.length; i += CHUNK) {
          await this.prisma.obligacion.createMany({
            data: obligacionesACrear.slice(i, i + CHUNK),
          });
        }
      }

      // 2) Crear MovimientoAfiliado(débito) por cada obligación de este período
      // que todavía no tenga su movimiento asociado. Esto sirve tanto para las
      // recién creadas como para corridas previas donde sólo se crearon
      // obligaciones sin movimientos.
      await this.generarMovimientosFaltantes(organizacionId, periodo);

      await this.audit.log({
        organizacionId,
        usuarioId,
        accion: 'OBLIGACIONES_MATERIALIZAR_EX_ANTE',
        entidad: 'Obligacion',
        metadata: {
          totalCreadas: obligacionesACrear.length,
          ...resumen,
        },
      });
    }

    return resumen;
  }

  /**
   * Para cada Obligacion del período con origen='materializacion_mensual' que
   * NO tenga aún un MovimientoAfiliado de débito asociado, crea el movimiento.
   * Es idempotente: si el movimiento ya existe, no duplica.
   *
   * Esto es lo que hace visible la deuda en la cuenta corriente del afiliado.
   */
  async generarMovimientosFaltantes(
    organizacionId: string,
    periodo: string,
  ): Promise<{ creados: number }> {
    const conceptosEnUso = await this.prisma.concepto.findMany({
      where: {
        organizacionId,
        codigo: { in: Object.values(CODIGO_CONCEPTO) },
      },
      select: { id: true, codigo: true },
    });
    const labelByConceptoId = new Map<string, string>();
    for (const c of conceptosEnUso) {
      const codigo = c.codigo;
      let cod: 'J17' | 'J22' | 'J38' | 'K16' = 'J17';
      if (codigo === CODIGO_CONCEPTO.J22) cod = 'J22';
      else if (codigo === CODIGO_CONCEPTO.J38) cod = 'J38';
      else if (codigo === CODIGO_CONCEPTO.K16) cod = 'K16';
      const labels = {
        J17: 'J17 - Cuota societaria',
        J22: 'J22 - Coseguro',
        J38: 'J38 - Colaterales',
        K16: 'K16 - Orden de crédito',
      };
      labelByConceptoId.set(c.id.toString(), labels[cod]);
    }

    // Fecha del movimiento = primer día del período (orden cronológico).
    const [y, m] = periodo.split('-').map(Number);
    const fecha = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));

    // Obligaciones materializadas sin movimiento de débito asociado.
    const pendientes = await this.prisma.obligacion.findMany({
      where: {
        organizacionId,
        periodo,
        origen: 'materializacion_mensual',
        MovimientoAfiliado: {
          none: { naturaleza: 'debito', origen: 'cuota' },
        },
      },
      select: {
        id: true,
        afiliadoId: true,
        padronId: true,
        conceptoId: true,
        monto: true,
      },
    });

    if (pendientes.length === 0) return { creados: 0 };

    const movimientosData = pendientes.map((o) => ({
      organizacionId,
      afiliadoId: o.afiliadoId,
      padronId: o.padronId,
      fecha,
      naturaleza: 'debito' as const,
      origen: 'cuota' as const,
      concepto: labelByConceptoId.get(o.conceptoId.toString()) ?? 'Obligación mensual',
      importe: o.monto,
      periodoContable: periodo,
      obligacionId: o.id,
    }));

    const CHUNK = 200;
    for (let i = 0; i < movimientosData.length; i += CHUNK) {
      await this.prisma.movimientoAfiliado.createMany({
        data: movimientosData.slice(i, i + CHUNK),
      });
    }

    return { creados: movimientosData.length };
  }

  private async existeObligacion(
    organizacionId: string,
    afiliadoId: bigint,
    conceptoId: bigint,
    periodo: string,
  ): Promise<boolean> {
    const r = await this.prisma.obligacion.findFirst({
      where: { organizacionId, afiliadoId, conceptoId, periodo },
      select: { id: true },
    });
    return !!r;
  }
}
