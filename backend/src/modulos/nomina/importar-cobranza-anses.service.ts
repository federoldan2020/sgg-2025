import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { CoberturaService } from '../suspensiones/cobertura.service';
import { SuspensionesService } from '../suspensiones/suspensiones.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { parseTxtAnses, type ItemAnses } from './parsers/anses.parser';

/**
 * Importador del TXT de retorno de ANSES (archivo UDAME) para jubilados.
 *
 * Diferencias vs el importador de Cómputos:
 *   - El TXT viene en encoding `latin-1` (ya decodificado por el controller).
 *   - Sólo trae J17 (cuota societaria); ANSES no descuenta J22/J38/K16.
 *   - El matching es por **numero de beneficio ANSES** (`Padron.numeroBeneficio`),
 *     NO por padrón ni por DNI. Cada padrón jubilado tiene UN beneficio.
 *   - Si un beneficio del TXT no matchea contra ningún Padron en BD, la
 *     importación se bloquea — el operador debe cargar el beneficio en el
 *     padrón correspondiente antes de reintentar.
 *
 * Documentación funcional completa: docs/UDAME_format.md
 */

export type PreviewAnsesResult = {
  ok: boolean;
  hash: string;
  periodo: string;
  resumen: {
    totalLineas: number;
    beneficiosEnTxt: number;
    beneficiosEncontrados: number;
    beneficiosFaltantes: number;
    montoTotalJ17: number;
  };
  periodosDetectados: string[];
  /** Beneficios del TXT que no existen en ningún Padron de la org. */
  beneficiosFaltantes: Array<{
    beneficio: string;
    apellidoNombre: string;
    dni: string;
    cuit: string;
    monto: number;
  }>;
  erroresParseo: Array<{ linea: number; raw: string; motivo: string }>;
  warnings: Array<{ linea: number; mensaje: string }>;
  items?: ItemAnses[];
};

export type ConfirmacionAnsesResult = {
  loteId: string;
  periodo: string;
  beneficiosAplicados: number;
  afiliadosTocados: number;
  montoTotal: number;
  rehabilitados: Array<{ afiliadoId: string; dni: string; apellidoNombre: string }>;
};

@Injectable()
export class ImportarCobranzaAnsesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cobertura: CoberturaService,
    private readonly suspensiones: SuspensionesService,
    private readonly movs: MovimientosService,
  ) {}

  /**
   * Parsea el TXT (ya decodificado en latin-1), valida que todos los
   * beneficios existan en BD y devuelve un preview. NO escribe nada.
   */
  async preview(organizacionId: string, contenido: string): Promise<PreviewAnsesResult> {
    const parsed = parseTxtAnses(contenido);
    const hash = crypto.createHash('sha256').update(contenido).digest('hex');

    if (parsed.items.length === 0) {
      throw new BadRequestException(
        `No se pudo parsear ninguna línea del archivo. ${parsed.errores.length} errores.`,
      );
    }
    if (parsed.periodosDetectados.length === 0) {
      throw new BadRequestException('No se detectó período en el archivo.');
    }
    if (parsed.periodosDetectados.length > 1) {
      throw new BadRequestException(
        `El archivo mezcla períodos distintos: ${parsed.periodosDetectados.join(', ')}`,
      );
    }
    const periodo = parsed.periodosDetectados[0];

    // Match por número de beneficio.
    const beneficiosTxt = Array.from(new Set(parsed.items.map((i) => i.beneficio)));
    const padronesDb = await this.prisma.padron.findMany({
      where: {
        organizacionId,
        numeroBeneficio: { in: beneficiosTxt },
      },
      select: { id: true, numeroBeneficio: true, afiliadoId: true },
    });
    const setEncontrados = new Set(
      padronesDb.map((p) => p.numeroBeneficio).filter((b): b is string => !!b),
    );

    const beneficiosFaltantes: PreviewAnsesResult['beneficiosFaltantes'] = [];
    for (const item of parsed.items) {
      if (setEncontrados.has(item.beneficio)) continue;
      beneficiosFaltantes.push({
        beneficio: item.beneficio,
        apellidoNombre: item.apellidoNombre,
        dni: item.dniRaw,
        cuit: item.cuit,
        monto: item.monto,
      });
    }

    const montoTotalJ17 = parsed.items.reduce((acc, it) => acc + it.monto, 0);
    const ok = beneficiosFaltantes.length === 0 && parsed.errores.length === 0;

    return {
      ok,
      hash,
      periodo,
      resumen: {
        totalLineas: parsed.totalLineas,
        beneficiosEnTxt: beneficiosTxt.length,
        beneficiosEncontrados: setEncontrados.size,
        beneficiosFaltantes: beneficiosFaltantes.length,
        montoTotalJ17,
      },
      periodosDetectados: parsed.periodosDetectados,
      beneficiosFaltantes,
      erroresParseo: parsed.errores,
      warnings: parsed.warnings,
      items: ok ? parsed.items : undefined,
    };
  }

  /**
   * Aplica la cobranza ANSES:
   *  - Crea LoteNomina con canal/origen distintivo (`canal: 'ANSES'`).
   *  - Crea MovimientoAfiliado(credito, origen='nomina') por cada beneficio
   *    matcheado con el monto J17 descontado.
   *  - Actualiza Padron.ultimoPeriodoCobranzaJ17 / ultimoMontoCobradoJ17.
   *  - Recalcula cobertura + rehabilita afiliados al día.
   *
   * Idempotente por hash: si el mismo archivo ya se cargó, error.
   */
  async confirmar(
    organizacionId: string,
    contenido: string,
    opts: { usuarioId?: string; archivoNombre?: string } = {},
  ): Promise<ConfirmacionAnsesResult> {
    const prev = await this.preview(organizacionId, contenido);
    if (!prev.ok || !prev.items) {
      throw new BadRequestException(
        `No se puede confirmar: ${prev.beneficiosFaltantes.length} beneficios faltantes o ${prev.erroresParseo.length} errores de parseo.`,
      );
    }

    // Idempotencia.
    const yaCargado = await this.prisma.loteNomina.findFirst({
      where: {
        organizacionId,
        periodo: prev.periodo,
        hashContenido: prev.hash,
        estado: 'confirmado',
      },
      select: { id: true },
    });
    if (yaCargado) {
      throw new BadRequestException(
        `Este archivo ya fue cargado (lote ${yaCargado.id.toString()}).`,
      );
    }

    // Mapeo beneficio → padron + afiliado.
    const beneficios = Array.from(new Set(prev.items.map((i) => i.beneficio)));
    const padronesDb = await this.prisma.padron.findMany({
      where: { organizacionId, numeroBeneficio: { in: beneficios } },
      select: { id: true, numeroBeneficio: true, afiliadoId: true },
    });
    const mapaBeneficio = new Map(
      padronesDb
        .filter((p) => p.numeroBeneficio)
        .map((p) => [p.numeroBeneficio as string, p]),
    );

    const [yStr, mStr] = prev.periodo.split('-');
    const fechaMovimiento = new Date(Date.UTC(Number(yStr), Number(mStr), 0, 23, 59, 59));

    const afiliadosTocadosSet = new Set<bigint>();
    const updatesPadron: Array<{
      id: bigint;
      data: {
        ultimoPeriodoCobranzaJ17: string;
        ultimoMontoCobradoJ17: number;
        evaluadoCoberturaEn: Date;
      };
    }> = [];
    const movimientosData: Array<{
      organizacionId: string;
      afiliadoId: bigint;
      padronId: bigint;
      fecha: Date;
      naturaleza: 'credito';
      origen: 'nomina';
      concepto: string;
      importe: number;
      periodoContable: string;
    }> = [];
    const detallesData: Array<{
      loteId: bigint;
      afiliadoId: bigint;
      padronId: bigint;
      codigo: string;
      monto: number;
    }> = [];

    let montoTotal = 0;
    const now = new Date();

    for (const item of prev.items) {
      const padronDb = mapaBeneficio.get(item.beneficio);
      if (!padronDb) continue; // ya validado en preview, pero por las dudas

      afiliadosTocadosSet.add(padronDb.afiliadoId);
      montoTotal += item.monto;

      updatesPadron.push({
        id: padronDb.id,
        data: {
          ultimoPeriodoCobranzaJ17: prev.periodo,
          ultimoMontoCobradoJ17: item.monto,
          evaluadoCoberturaEn: now,
        },
      });

      detallesData.push({
        loteId: 0n,
        afiliadoId: padronDb.afiliadoId,
        padronId: padronDb.id,
        codigo: 'J17',
        monto: item.monto,
      });

      if (item.monto > 0) {
        movimientosData.push({
          organizacionId,
          afiliadoId: padronDb.afiliadoId,
          padronId: padronDb.id,
          fecha: fechaMovimiento,
          naturaleza: 'credito',
          origen: 'nomina',
          concepto: 'J17 - Cuota societaria (ANSES)',
          importe: item.monto,
          periodoContable: prev.periodo,
        });
      }
    }

    const lote = await this.prisma.$transaction(
      async (tx) => {
        const lote = await tx.loteNomina.create({
          data: {
            organizacionId,
            periodo: prev.periodo,
            hashContenido: prev.hash,
            archivoNombre: opts.archivoNombre,
            cargadoPor: opts.usuarioId ?? null,
            estado: 'confirmado',
            canal: 'ANSES',
          },
        });

        // Updates de padrones en chunks paralelos.
        const CHUNK = 50;
        for (let i = 0; i < updatesPadron.length; i += CHUNK) {
          const slice = updatesPadron.slice(i, i + CHUNK);
          await Promise.all(
            slice.map((u) =>
              tx.padron.update({ where: { id: u.id }, data: u.data }),
            ),
          );
        }

        if (detallesData.length > 0) {
          await tx.nominaDetalle.createMany({
            data: detallesData.map((d) => ({ ...d, loteId: lote.id })),
          });
        }
        // Movimientos por cuenta corriente vía ledger centralizado.
        // Mismo patrón que Cómputos: postMovimiento mantiene Padron.saldo,
        // saldoPosterior y Afiliado.saldo coherentes. En Fase 2 hará matching
        // contra Obligacion del período.
        for (const m of movimientosData) {
          await this.movs.postMovimiento({
            tx,
            organizacionId: m.organizacionId,
            afiliadoId: m.afiliadoId,
            padronId: m.padronId,
            fecha: m.fecha,
            naturaleza: m.naturaleza,
            origen: m.origen,
            concepto: m.concepto,
            importe: m.importe,
            periodoContable: m.periodoContable,
          });
        }

        return lote;
      },
      { timeout: 10 * 60 * 1000, maxWait: 30000 },
    );

    // Recalcular cobertura + intentar rehabilitar.
    const rehabilitados: ConfirmacionAnsesResult['rehabilitados'] = [];
    const afiliadosTocados = Array.from(afiliadosTocadosSet);
    const COB_CHUNK = 8;
    for (let i = 0; i < afiliadosTocados.length; i += COB_CHUNK) {
      const slice = afiliadosTocados.slice(i, i + COB_CHUNK);
      await Promise.all(
        slice.map(async (afiliadoId) => {
          try {
            await this.cobertura.calcular(organizacionId, afiliadoId, prev.periodo);
          } catch {
            return;
          }
          const suspendido = await this.suspensiones.estaSuspendido(
            organizacionId,
            afiliadoId,
          );
          if (!suspendido) return;
          try {
            const r = await this.suspensiones.rehabilitar(
              organizacionId,
              afiliadoId,
              'cobranza_periodo',
            );
            if (r && !('yaActivo' in r)) {
              const af = await this.prisma.afiliado.findFirst({
                where: { id: afiliadoId },
                select: { dni: true, apellido: true, nombre: true },
              });
              rehabilitados.push({
                afiliadoId: afiliadoId.toString(),
                dni: af?.dni.toString() ?? '',
                apellidoNombre: `${af?.apellido ?? ''} ${af?.nombre ?? ''}`.trim(),
              });
            }
          } catch {
            // deuda previa → no rehabilita, sigue.
          }
        }),
      );
    }

    await this.audit.log({
      organizacionId,
      usuarioId: opts.usuarioId,
      accion: 'NOMINA_IMPORTAR_COBRANZA_ANSES',
      entidad: 'LoteNomina',
      entidadId: lote.id.toString(),
      metadata: {
        periodo: prev.periodo,
        beneficios: prev.items.length,
        afiliados: afiliadosTocados.length,
        montoTotal,
        rehabilitados: rehabilitados.length,
        hash: prev.hash,
        archivo: opts.archivoNombre,
      },
    });

    return {
      loteId: lote.id.toString(),
      periodo: prev.periodo,
      beneficiosAplicados: prev.items.length,
      afiliadosTocados: afiliadosTocados.length,
      montoTotal,
      rehabilitados,
    };
  }
}
