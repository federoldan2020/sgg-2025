import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import {
  parseNovedadesXlsx,
  type CodigoNovedad,
  type NovedadFila,
} from './parsers/novedades.parser';

/** origen con el que se etiquetan las obligaciones sembradas desde el legacy. */
const ORIGEN = 'novedad_legacy';

/** Código de novedad → código de Concepto en la BD. */
const CODIGO_CONCEPTO: Record<CodigoNovedad, string> = {
  J17: 'CUOTA_SOC',
  J22: 'COSEGURO',
  J38: 'ADIC_COL',
  K16: 'ORDEN_CREDITO',
};

/**
 * Conceptos que SÍ generan obligación de monto fijo a conciliar contra la
 * devolución. J17 queda afuera: en la novedad es un flag (alta/baja de la cuota
 * societaria), el 2 % real lo liquida Cómputos y vuelve en el retorno.
 */
const CONCEPTOS_CON_OBLIGACION: CodigoNovedad[] = ['K16', 'J22', 'J38'];

function digitsOnly(s: string): string {
  const limpio = (s ?? '').replace(/[^\d]/g, '');
  return limpio.replace(/^0+/, '') || (limpio ? '0' : '');
}

const PERIODO_RE = /^\d{4}-\d{2}$/;

export type NovedadesPreview = {
  periodo: string;
  totalFilas: number;
  resumen: {
    filasConPadron: number;
    padronesEncontrados: number;
    padronesFaltantes: number;
    obligacionesACrear: number;
    obligacionesYaExistentes: number;
    montoPorConcepto: Record<string, number>; // pesos a sembrar por código
    j17Flags: { alta: number; baja: number }; // informativo (no generan obligación)
  };
  /** Padrones de la planilla que no existen en el sistema (se agregan luego). */
  padronesFaltantes: Array<{
    fila: number;
    padron: string;
    centro: string;
    conceptos: Partial<Record<CodigoNovedad, number>>;
  }>;
  errores: Array<{ fila: number; motivo: string }>;
};

export type NovedadesConfirmacion = {
  periodo: string;
  obligacionesCreadas: number;
  obligacionesOmitidas: number; // ya existían (idempotencia)
  padronesFaltantes: number;
};

@Injectable()
export class ImportarNovedadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Carga el contexto común (padrones de la org y conceptos). */
  private async cargarContexto(organizacionId: string) {
    const [padrones, conceptos] = await Promise.all([
      this.prisma.padron.findMany({
        where: { organizacionId },
        select: { id: true, padron: true, afiliadoId: true },
      }),
      this.prisma.concepto.findMany({
        where: { organizacionId },
        select: { id: true, codigo: true },
      }),
    ]);

    // Mapa por dígitos (sin ceros a la izquierda) para matchear sin depender del formato.
    const padronPorDigitos = new Map<
      string,
      { id: bigint; afiliadoId: bigint; padron: string }
    >();
    for (const p of padrones) {
      padronPorDigitos.set(digitsOnly(p.padron), p);
    }

    const conceptoIdPorCodigo = new Map<string, bigint>();
    for (const c of conceptos) conceptoIdPorCodigo.set(c.codigo, c.id);

    return { padronPorDigitos, conceptoIdPorCodigo };
  }

  /** Une filas repetidas del mismo padrón (por si vinieran particionadas). */
  private mergeFilas(filas: NovedadFila[]): Map<string, NovedadFila> {
    const porPadron = new Map<string, NovedadFila>();
    for (const f of filas) {
      const prev = porPadron.get(f.padronDigitos);
      if (!prev) {
        porPadron.set(f.padronDigitos, { ...f, conceptos: { ...f.conceptos } });
        continue;
      }
      for (const [k, v] of Object.entries(f.conceptos)) {
        const key = k as CodigoNovedad;
        prev.conceptos[key] = (prev.conceptos[key] ?? 0) + (v ?? 0);
      }
    }
    return porPadron;
  }

  async preview(
    organizacionId: string,
    buf: Buffer,
    periodo: string,
  ): Promise<NovedadesPreview> {
    if (!PERIODO_RE.test(periodo)) {
      throw new BadRequestException(`Período inválido: "${periodo}" (esperado YYYY-MM).`);
    }

    const parsed = await parseNovedadesXlsx(buf);
    const { padronPorDigitos, conceptoIdPorCodigo } =
      await this.cargarContexto(organizacionId);

    // Validar que existan los conceptos que vamos a usar.
    for (const cod of CONCEPTOS_CON_OBLIGACION) {
      if (!conceptoIdPorCodigo.get(CODIGO_CONCEPTO[cod])) {
        throw new BadRequestException(
          `Falta el concepto "${CODIGO_CONCEPTO[cod]}" en la organización.`,
        );
      }
    }

    const porPadron = this.mergeFilas(parsed.filas);

    // Obligaciones ya sembradas para este período/origen (idempotencia).
    const conceptoIds = CONCEPTOS_CON_OBLIGACION.map(
      (c) => conceptoIdPorCodigo.get(CODIGO_CONCEPTO[c])!,
    );
    const existentes = await this.prisma.obligacion.findMany({
      where: {
        organizacionId,
        periodo,
        origen: ORIGEN,
        conceptoId: { in: conceptoIds },
      },
      select: { afiliadoId: true, conceptoId: true },
    });
    const setExistentes = new Set(
      existentes.map((o) => `${o.afiliadoId}-${o.conceptoId}`),
    );

    const padronesFaltantes: NovedadesPreview['padronesFaltantes'] = [];
    const montoPorConcepto: Record<string, number> = {};
    const j17Flags = { alta: 0, baja: 0 };
    let padronesEncontrados = 0;
    let obligacionesACrear = 0;
    let obligacionesYaExistentes = 0;

    for (const f of porPadron.values()) {
      // J17 = flag, sólo informativo.
      if (f.conceptos.J17 != null) {
        if (f.conceptos.J17 > 0) j17Flags.alta++;
        else j17Flags.baja++;
      }

      const padronDb = padronPorDigitos.get(f.padronDigitos);
      if (!padronDb) {
        padronesFaltantes.push({
          fila: f.fila,
          padron: f.padronRaw,
          centro: f.centro,
          conceptos: f.conceptos,
        });
        continue;
      }
      padronesEncontrados++;

      for (const cod of CONCEPTOS_CON_OBLIGACION) {
        const monto = f.conceptos[cod];
        if (monto == null || monto <= 0) continue;
        const conceptoId = conceptoIdPorCodigo.get(CODIGO_CONCEPTO[cod])!;
        montoPorConcepto[cod] = (montoPorConcepto[cod] ?? 0) + monto;
        if (setExistentes.has(`${padronDb.afiliadoId}-${conceptoId}`)) {
          obligacionesYaExistentes++;
        } else {
          obligacionesACrear++;
        }
      }
    }

    return {
      periodo,
      totalFilas: parsed.totalFilas,
      resumen: {
        filasConPadron: porPadron.size,
        padronesEncontrados,
        padronesFaltantes: padronesFaltantes.length,
        obligacionesACrear,
        obligacionesYaExistentes,
        montoPorConcepto,
        j17Flags,
      },
      padronesFaltantes,
      errores: parsed.errores,
    };
  }

  async confirmar(
    organizacionId: string,
    buf: Buffer,
    periodo: string,
    opts: { usuarioId?: string; archivoNombre?: string } = {},
  ): Promise<NovedadesConfirmacion> {
    if (!PERIODO_RE.test(periodo)) {
      throw new BadRequestException(`Período inválido: "${periodo}" (esperado YYYY-MM).`);
    }

    const parsed = await parseNovedadesXlsx(buf);
    const { padronPorDigitos, conceptoIdPorCodigo } =
      await this.cargarContexto(organizacionId);

    for (const cod of CONCEPTOS_CON_OBLIGACION) {
      if (!conceptoIdPorCodigo.get(CODIGO_CONCEPTO[cod])) {
        throw new BadRequestException(
          `Falta el concepto "${CODIGO_CONCEPTO[cod]}" en la organización.`,
        );
      }
    }

    const porPadron = this.mergeFilas(parsed.filas);
    const conceptoIds = CONCEPTOS_CON_OBLIGACION.map(
      (c) => conceptoIdPorCodigo.get(CODIGO_CONCEPTO[c])!,
    );
    const existentes = await this.prisma.obligacion.findMany({
      where: {
        organizacionId,
        periodo,
        origen: ORIGEN,
        conceptoId: { in: conceptoIds },
      },
      select: { afiliadoId: true, conceptoId: true },
    });
    const setExistentes = new Set(
      existentes.map((o) => `${o.afiliadoId}-${o.conceptoId}`),
    );

    const aCrear: Array<{
      organizacionId: string;
      afiliadoId: bigint;
      padronId: bigint;
      conceptoId: bigint;
      periodo: string;
      origen: string;
      monto: number;
      saldo: number;
      estado: string;
      bloqueada: boolean;
    }> = [];
    let padronesFaltantes = 0;

    for (const f of porPadron.values()) {
      const padronDb = padronPorDigitos.get(f.padronDigitos);
      if (!padronDb) {
        padronesFaltantes++;
        continue;
      }
      for (const cod of CONCEPTOS_CON_OBLIGACION) {
        const monto = f.conceptos[cod];
        if (monto == null || monto <= 0) continue;
        const conceptoId = conceptoIdPorCodigo.get(CODIGO_CONCEPTO[cod])!;
        if (setExistentes.has(`${padronDb.afiliadoId}-${conceptoId}`)) continue;
        aCrear.push({
          organizacionId,
          afiliadoId: padronDb.afiliadoId,
          padronId: padronDb.id,
          conceptoId,
          periodo,
          origen: ORIGEN,
          monto,
          saldo: monto,
          estado: 'pendiente',
          bloqueada: false,
        });
        // evitar duplicar si el mismo padrón apareciera dos veces tras el merge
        setExistentes.add(`${padronDb.afiliadoId}-${conceptoId}`);
      }
    }

    let creadas = 0;
    if (aCrear.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < aCrear.length; i += CHUNK) {
        const slice = aCrear.slice(i, i + CHUNK);
        const r = await this.prisma.obligacion.createMany({ data: slice });
        creadas += r.count;
      }
    }

    await this.audit.log({
      organizacionId,
      usuarioId: opts.usuarioId,
      accion: 'NOVEDADES_IMPORTAR_LEGACY',
      entidad: 'Obligacion',
      entidadId: periodo,
      metadata: {
        periodo,
        creadas,
        omitidas: porPadron.size - padronesFaltantes,
        padronesFaltantes,
        archivo: opts.archivoNombre,
      },
    });

    return {
      periodo,
      obligacionesCreadas: creadas,
      obligacionesOmitidas: existentes.length,
      padronesFaltantes,
    };
  }
}
