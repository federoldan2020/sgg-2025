import { BadRequestException, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { CoberturaService } from '../suspensiones/cobertura.service';
import { SuspensionesService } from '../suspensiones/suspensiones.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { parseTxt, type ItemTxt } from './parsers/computos.parser';

export type PreviewResult = {
  ok: boolean;
  hash: string;
  periodo: string;
  resumen: {
    totalLineas: number;
    padronesEnTxt: number;
    padronesEncontrados: number;
    padronesFaltantes: number;
    afiliadosAfectados: number;
    cobranzasPorCodigo: Record<string, number>; // suma de montos por código
  };
  periodosDetectados: string[];
  /** Si hay padrones faltantes, no se permite confirmar. */
  padronesFaltantes: Array<{
    padron: string;
    centro: string;
    dni: number;
    apellidoNombre: string;
    cobranzas: ItemTxt['cobranzas'];
  }>;
  erroresParseo: Array<{ linea: number; raw: string; motivo: string }>;
  /** Items listos para confirmar (sólo si ok=true). */
  items?: ItemTxt[];
};

export type ConfirmacionResult = {
  loteId: string;
  periodo: string;
  padronesActualizados: number;
  afiliadosTocados: number;
  rehabilitados: Array<{ afiliadoId: string; dni: string; apellidoNombre: string }>;
  /** Aplicación de lo cobrado a las obligaciones (por padrón+concepto, FIFO). */
  conciliacion: {
    obligacionesAplicadas: number;
    pagadas: number;
    parciales: number;
    excedentes: number; // padrones donde se cobró más que la deuda registrada
  };
};

/** Código de cobranza → código de Concepto en la BD. */
const CODIGO_CONCEPTO_COBRANZA: Record<'J17' | 'J22' | 'J38' | 'K16', string> = {
  J17: 'CUOTA_SOC',
  J22: 'COSEGURO',
  J38: 'ADIC_COL',
  K16: 'ORDEN_CREDITO',
};

@Injectable()
export class ImportarCobranzaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cobertura: CoberturaService,
    private readonly suspensiones: SuspensionesService,
    private readonly movs: MovimientosService,
  ) {}

  /**
   * Parsea el TXT, valida que todos los padrones existan en BD, y devuelve un
   * preview. NO escribe nada.
   */
  async preview(organizacionId: string, contenido: string): Promise<PreviewResult> {
    const parsed = parseTxt(contenido);
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

    // Verificar padrones existentes en BD por organización.
    const padronesEnTxt = Array.from(new Set(parsed.items.map((i) => i.padron)));
    const existentes = await this.prisma.padron.findMany({
      where: { organizacionId, padron: { in: padronesEnTxt } },
      select: { id: true, padron: true, afiliadoId: true },
    });
    const setExistentes = new Set(existentes.map((e) => e.padron));

    // Agrupar items por padrón para detectar faltantes y armar el preview.
    const porPadron = new Map<string, ItemTxt[]>();
    for (const it of parsed.items) {
      const arr = porPadron.get(it.padron) ?? [];
      arr.push(it);
      porPadron.set(it.padron, arr);
    }

    const padronesFaltantes: PreviewResult['padronesFaltantes'] = [];
    for (const [padron, items] of porPadron.entries()) {
      if (setExistentes.has(padron)) continue;
      const first = items[0];
      // Si varias líneas para el mismo padrón, mergeo las cobranzas.
      const merged: ItemTxt['cobranzas'] = {};
      for (const it of items) {
        for (const [k, v] of Object.entries(it.cobranzas)) {
          const key = k as 'J17' | 'J22' | 'J38' | 'K16';
          merged[key] = (merged[key] ?? 0) + (v ?? 0);
        }
      }
      padronesFaltantes.push({
        padron,
        centro: first.centro,
        dni: first.dni,
        apellidoNombre: first.apellidoNombre,
        cobranzas: merged,
      });
    }

    const afiliadosAfectados = new Set(existentes.map((e) => e.afiliadoId.toString()));
    const cobranzasPorCodigo: Record<string, number> = {};
    for (const it of parsed.items) {
      for (const [k, v] of Object.entries(it.cobranzas)) {
        cobranzasPorCodigo[k] = (cobranzasPorCodigo[k] ?? 0) + (v ?? 0);
      }
    }

    const ok = padronesFaltantes.length === 0 && parsed.errores.length === 0;

    return {
      ok,
      hash,
      periodo,
      resumen: {
        totalLineas: parsed.totalLineas,
        padronesEnTxt: padronesEnTxt.length,
        padronesEncontrados: existentes.length,
        padronesFaltantes: padronesFaltantes.length,
        afiliadosAfectados: afiliadosAfectados.size,
        cobranzasPorCodigo,
      },
      periodosDetectados: parsed.periodosDetectados,
      padronesFaltantes,
      erroresParseo: parsed.errores,
      items: ok ? parsed.items : undefined,
    };
  }

  /**
   * Aplica la cobranza al sistema:
   *  - Actualiza Padron.j17/j22/j38/k16 con los montos del período.
   *  - Setea ultimoPeriodoCobranzaJ17 / ultimoMontoCobradoJ17.
   *  - Crea LoteNomina + NominaDetalle para auditoría.
   *  - Recalcula cobertura por afiliado afectado.
   *  - Rehabilita si corresponde.
   *
   * Idempotente por hash: si el mismo archivo ya se cargó, no duplica.
   */
  async confirmar(
    organizacionId: string,
    contenido: string,
    opts: { usuarioId?: string; archivoNombre?: string } = {},
  ): Promise<ConfirmacionResult> {
    const prev = await this.preview(organizacionId, contenido);
    if (!prev.ok || !prev.items) {
      throw new BadRequestException(
        `No se puede confirmar: ${prev.padronesFaltantes.length} padrones faltantes o ${prev.erroresParseo.length} errores de parseo.`,
      );
    }

    // Idempotencia: si ya hay lote con mismo hash y período, retornarlo.
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
        `Este archivo ya fue cargado (lote ${yaCargado.id.toString()}). Si querés reimportar, anulá el lote existente.`,
      );
    }

    // Resolver padrón → padronId + afiliadoId
    const padronesEnTxt = Array.from(new Set(prev.items.map((i) => i.padron)));
    const padronesDb = await this.prisma.padron.findMany({
      where: { organizacionId, padron: { in: padronesEnTxt } },
      select: { id: true, padron: true, afiliadoId: true },
    });
    const mapaPadron = new Map(padronesDb.map((p) => [p.padron, p]));

    // Agrupar items por padrón (puede haber varias líneas del mismo padrón
    // en el archivo si vinieran particionadas; las mergeo).
    const porPadron = new Map<string, { J17: number; J22: number; J38: number; K16: number }>();
    for (const it of prev.items) {
      const acc = porPadron.get(it.padron) ?? { J17: 0, J22: 0, J38: 0, K16: 0 };
      acc.J17 += it.cobranzas.J17 ?? 0;
      acc.J22 += it.cobranzas.J22 ?? 0;
      acc.J38 += it.cobranzas.J38 ?? 0;
      acc.K16 += it.cobranzas.K16 ?? 0;
      porPadron.set(it.padron, acc);
    }

    const afiliadosTocadosSet = new Set<bigint>();
    const now = new Date();

    // Fecha del movimiento: último día del período (cuando Cómputos liquidó).
    const [yStr, mStr] = prev.periodo.split('-');
    const fechaMovimiento = new Date(Date.UTC(Number(yStr), Number(mStr), 0, 23, 59, 59));

    // Conceptos descriptivos para la cuenta corriente.
    const CONCEPTOS: Record<string, string> = {
      J17: 'J17 - Cuota societaria',
      J22: 'J22 - Coseguro',
      J38: 'J38 - Colaterales',
      K16: 'K16 - Orden de crédito',
    };

    // Pre-armar los updates de padrones (sólo tracking, NO los importes).
    const updatesPadron: Array<{
      id: bigint;
      data: {
        ultimoPeriodoCobranzaJ17?: string;
        ultimoMontoCobradoJ17?: number;
        evaluadoCoberturaEn: Date;
      };
    }> = [];

    // Detalles para NominaDetalle (auditoría del TXT).
    const detallesData: Array<{
      loteId: bigint;
      afiliadoId: bigint;
      padronId: bigint;
      codigo: string;
      monto: number;
    }> = [];

    // Líneas a registrar como cobranza (cada una con matching contra Obligación
    // mediante MovimientosService.registrarCobranza).
    const cobranzasARegistrar: Array<{
      afiliadoId: bigint;
      padronId: bigint;
      codigo: 'J17' | 'J22' | 'J38' | 'K16';
      monto: number;
    }> = [];

    for (const [padronStr, totales] of porPadron.entries()) {
      const padronDb = mapaPadron.get(padronStr);
      if (!padronDb) continue;
      afiliadosTocadosSet.add(padronDb.afiliadoId);

      updatesPadron.push({
        id: padronDb.id,
        data: {
          ...(totales.J17 > 0
            ? { ultimoPeriodoCobranzaJ17: prev.periodo, ultimoMontoCobradoJ17: totales.J17 }
            : {}),
          evaluadoCoberturaEn: now,
        },
      });

      for (const codigo of ['J17', 'J22', 'J38', 'K16'] as const) {
        const monto = totales[codigo];
        if (monto <= 0) continue;

        detallesData.push({
          loteId: 0n, // se completa tras crear el lote
          afiliadoId: padronDb.afiliadoId,
          padronId: padronDb.id,
          codigo,
          monto,
        });

        cobranzasARegistrar.push({
          afiliadoId: padronDb.afiliadoId,
          padronId: padronDb.id,
          codigo,
          monto,
        });
      }
    }

    // Transacción con timeout extendido. Ejecuciones en lote (createMany +
    // updates paralelizados por chunks).
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
          },
        });

        // Updates de padrones en chunks paralelos para no saturar el pool.
        const CHUNK = 50;
        for (let i = 0; i < updatesPadron.length; i += CHUNK) {
          const slice = updatesPadron.slice(i, i + CHUNK);
          await Promise.all(
            slice.map((u) =>
              tx.padron.update({ where: { id: u.id }, data: u.data }),
            ),
          );
        }

        // Inserción bulk de detalles (mucho más rápido que N inserts).
        if (detallesData.length > 0) {
          await tx.nominaDetalle.createMany({
            data: detallesData.map((d) => ({ ...d, loteId: lote.id })),
          });
        }

        // Cobranza con matching automático: cada línea (padrón × concepto)
        // intenta aplicarse FIFO contra obligaciones pendientes del mismo
        // padrón+concepto. Si sobra cobranza o no hay obligación matcheable,
        // queda registrada como crédito huérfano con requiereRevision=true
        // (bandeja del operador). Ver memory/project_modelo_saldos.md.
        for (const c of cobranzasARegistrar) {
          await this.movs.registrarCobranza({
            tx,
            organizacionId,
            afiliadoId: c.afiliadoId,
            padronId: c.padronId,
            conceptoCodigo: CODIGO_CONCEPTO_COBRANZA[c.codigo],
            conceptoLabel: CONCEPTOS[c.codigo],
            importe: c.monto,
            fecha: fechaMovimiento,
            periodo: prev.periodo,
            origen: 'nomina',
            // J17 es porcentual: el monto recién se conoce al llegar la
            // cobranza. La obligación se materializa con el monto cobrado
            // y se paga en el mismo paso. Resto de conceptos siguen el
            // flujo normal (matching contra obligación pre-existente).
            autoCrearObligacionSiFalta: c.codigo === 'J17',
          });
        }

        return lote;
      },
      { timeout: 10 * 60 * 1000, maxWait: 30000 },
    );

    // Conciliar contra obligaciones bloqueadas: aplicar lo cobrado a cada
    // Obligacion cobrada y desbloquearla. Esto cierra el ciclo de la novedad
    // enviada (que las había bloqueado).
    await this.conciliarObligacionesBloqueadas(
      organizacionId,
      prev.periodo,
      Array.from(afiliadosTocadosSet),
    );

    // Conciliación: ya quedó hecha en registrarCobranza durante la tx
    // (matching FIFO + actualización de Obligacion.saldo + crédito vinculado).
    // Métricas agregadas: se recalculan a partir de la DB para el resumen.
    const conciliacion = await this.calcularEstadisticasConciliacion(
      organizacionId,
      prev.periodo,
      Array.from(afiliadosTocadosSet),
    );

    // Recalcular cobertura + intentar rehabilitar fuera de la transacción.
    // Paralelizado por chunks para no tardar minutos con miles de afiliados.
    const rehabilitados: ConfirmacionResult['rehabilitados'] = [];
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
            // deuda previa no saldada → no rehabilita, sigue normal.
          }
        }),
      );
    }

    await this.audit.log({
      organizacionId,
      usuarioId: opts.usuarioId,
      accion: 'NOMINA_IMPORTAR_COBRANZA',
      entidad: 'LoteNomina',
      entidadId: lote.id.toString(),
      metadata: {
        periodo: prev.periodo,
        padrones: prev.items.length,
        afiliados: afiliadosTocados.length,
        rehabilitados: rehabilitados.length,
        hash: prev.hash,
        archivo: opts.archivoNombre,
        conciliacion,
      },
    });

    return {
      loteId: lote.id.toString(),
      periodo: prev.periodo,
      padronesActualizados: porPadron.size,
      afiliadosTocados: afiliadosTocados.length,
      rehabilitados,
      conciliacion,
    };
  }

  /**
   * Concilia las obligaciones bloqueadas (enviadas a Cómputos) contra los
   * cobros del período. Para cada afiliado tocado:
   *  - Lista sus obligaciones bloqueadas.
   *  - Si hay MovimientoAfiliado(nomina) cubriendo el saldo → desbloquea,
   *    reduce saldo y marca conciliada.
   *  - Si no hay cobranza → la desbloquea de todos modos (Cómputos
   *    completó el ciclo de descuento del mes, la obligación vuelve a ser
   *    cobrable por caja para su saldo restante).
   *
   * Esta es una v1 conservadora: desbloquea TODAS las obligaciones
   * referenciadas por NovedadLoteObligacion del afiliado para el período
   * indicado en cuanto se procese el TXT. La aplicación fina de pagos a
   * obligaciones individuales queda para una iteración futura cuando se
   * implemente correctamente el matching por concepto+período.
   */
  private async conciliarObligacionesBloqueadas(
    organizacionId: string,
    periodo: string,
    afiliadosIds: bigint[],
  ): Promise<void> {
    if (afiliadosIds.length === 0) return;

    // Tomar las obligaciones bloqueadas de estos afiliados que fueron
    // referenciadas por algún lote enviado del período (o anterior).
    const obligaciones = await this.prisma.obligacion.findMany({
      where: {
        organizacionId,
        afiliadoId: { in: afiliadosIds },
        bloqueada: true,
        novedadLoteObligaciones: {
          some: {
            lote: { canal: 'ESC', estado: { in: ['enviado', 'parcialmente_conciliado'] } },
          },
        },
      },
      select: { id: true, novedadLoteObligaciones: { select: { id: true, loteId: true } } },
    });

    if (obligaciones.length === 0) return;

    const obligacionIds = obligaciones.map((o) => o.id);
    const ahora = new Date();

    await this.prisma.$transaction([
      this.prisma.obligacion.updateMany({
        where: { id: { in: obligacionIds } },
        data: {
          bloqueada: false,
          conciliacionEstado: 'descontado',
          conciliacionFecha: ahora,
        },
      }),
      this.prisma.novedadLoteObligacion.updateMany({
        where: { obligacionId: { in: obligacionIds }, desbloqueadaEn: null },
        data: { desbloqueadaEn: ahora },
      }),
    ]);

    // Marcar lotes como conciliados si todas sus obligaciones quedaron desbloqueadas.
    const lotesAfectados = new Set<bigint>();
    for (const o of obligaciones) {
      for (const r of o.novedadLoteObligaciones) lotesAfectados.add(r.loteId);
    }
    for (const loteId of lotesAfectados) {
      const pendientes = await this.prisma.novedadLoteObligacion.count({
        where: { loteId, desbloqueadaEn: null },
      });
      if (pendientes === 0) {
        await this.prisma.novedadLote.update({
          where: { id: loteId },
          data: { estado: 'conciliado', conciliadoEn: ahora },
        });
      } else {
        await this.prisma.novedadLote.updateMany({
          where: { id: loteId, estado: 'enviado' },
          data: { estado: 'parcialmente_conciliado' },
        });
      }
    }

    void periodo;
  }

  /**
   * Conciliación GRANULAR: aplica lo efectivamente cobrado a las obligaciones,
   * por (padrón, concepto), bajando el saldo. Es el cierre real del circuito:
   * la novedad sembró las obligaciones (K16/J22/J38) y acá la devolución las
   * cancela/parcializa.
   *
   * - Sólo K16/J22/J38 (montos fijos). J17 es el 2 % que liquida Cómputos: se
   *   registra como ingreso (MovimientoAfiliado) pero no tiene saldo que bajar.
   * - FIFO: aplica a las obligaciones abiertas del padrón más viejas primero
   *   (periodo asc), cubriendo arrastre antes que la cuota del mes.
   * - Idempotencia: la confirmación está protegida por hash del lote, así que
   *   este método corre una sola vez por archivo.
   */
  /**
   * Calcula estadísticas agregadas de la conciliación que ya hizo
   * registrarCobranza durante la tx. Mira las Obligaciones tocadas y los
   * movimientos huérfanos (requiereRevision=true) creados en este lote.
   */
  private async calcularEstadisticasConciliacion(
    organizacionId: string,
    periodo: string,
    afiliadosTocados: bigint[],
  ): Promise<ConfirmacionResult['conciliacion']> {
    const stats = { obligacionesAplicadas: 0, pagadas: 0, parciales: 0, excedentes: 0 };
    if (afiliadosTocados.length === 0) return stats;

    // Obligaciones del período (o anteriores) que fueron tocadas por cobranza
    // de estos afiliados.
    const conciliadas = await this.prisma.obligacion.findMany({
      where: {
        organizacionId,
        afiliadoId: { in: afiliadosTocados },
        periodo: { lte: periodo },
        conciliacionEstado: { in: ['descontado', 'parcial'] },
      },
      select: { estado: true },
    });
    stats.obligacionesAplicadas = conciliadas.length;
    stats.pagadas = conciliadas.filter((o) => o.estado === 'pagada').length;
    stats.parciales = conciliadas.filter((o) => o.estado === 'parcialmente_pagada').length;

    // Excedentes: créditos generados en este período que quedaron como
    // saldo a favor / huérfanos (requiereRevision=true).
    stats.excedentes = await this.prisma.movimientoAfiliado.count({
      where: {
        organizacionId,
        afiliadoId: { in: afiliadosTocados },
        periodoContable: periodo,
        origen: 'nomina',
        requiereRevision: true,
      },
    });

    return stats;
  }
}
