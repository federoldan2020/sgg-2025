import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { MovimientosService } from '../movimientos/movimientos.service';
import { ContabilidadService } from '../contabilidad/contabilidad.service';

// ======================= Helpers de periodo/corte =======================

// Sumar meses a "YYYY-MM"
function addMonths(yyyyMM: string, delta: number): string {
  const [y, m] = yyyyMM.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const y2 = d.getUTCFullYear();
  const m2 = d.getUTCMonth() + 1;
  return `${y2}-${String(m2).padStart(2, '0')}`;
}

// Resolver periodo destino por fecha de evento y día de corte
function resolverPeriodoDestino(fechaEvento: Date, corteDia: number): string {
  const y = fechaEvento.getUTCFullYear();
  const m = fechaEvento.getUTCMonth() + 1;
  const d = fechaEvento.getUTCDate();
  const periodo = `${y}-${String(m).padStart(2, '0')}`;
  return d <= corteDia ? periodo : addMonths(periodo, 1);
}

// Mapeo Sistema interno -> prefijo DPI (archivo)
function sistemaToDpiPrefix(s?: string | null): 'ES' | 'SG' {
  if (s === 'ESC') return 'ES';
  if (s === 'SG') return 'SG';
  if (s === 'SGR') return 'SG';
  return 'SG';
}

// Mes a 3 letras (archivo)
function mesAbrev(yyyyMM: string): string {
  const [, mm] = yyyyMM.split('-').map((x) => x);
  const n = Number(mm);
  const map = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  return map[(n - 1) % 12];
}

// ======================= Helpers de formato DPI =======================

// Divide padrón en base(6) + DV(1). Acepta "123456-7", "1234567", etc.
// Regla: el ÚLTIMO dígito es el DV; los 6 anteriores la base. Pad-left a 7 si viene corto.
function splitPadronDV(padronRaw: string): { base6: string; dv: string } {
  const onlyDigits = String(padronRaw).replace(/\D+/g, '');
  if (!onlyDigits) return { base6: '000000', dv: '0' };
  const norm7 = onlyDigits.padStart(7, '0');
  const dv = norm7.slice(-1);
  const base6 = norm7.slice(-7, -1);
  return { base6, dv };
}

// Formatea importe: 7 enteros + 2 decimales -> 9 chars, sin punto/coma, pad-left con 0
function formatImporte_9(impt: Prisma.Decimal | string | number | null | undefined): string {
  if (impt == null) return '000000000';
  const s = new Prisma.Decimal(String(impt)).toFixed(2);
  const compact = s.replace('.', '');
  return compact.padStart(9, '0');
}

// Normaliza código (3 chars)
function formatCodigo_3(cod?: string | null): string {
  if (!cod) return '   ';
  return String(cod).toUpperCase().padEnd(3, ' ').slice(0, 3);
}

// Left pad numérico (p.ej. centro 2 dígitos)
function padNum(n: number | string | null | undefined, width: number): string {
  if (n == null || n === '') return ''.padStart(width, '0');
  const s = String(n).replace(/\D+/g, '');
  return s.padStart(width, '0').slice(-width);
}

// Arma UNA línea de 80 posiciones para DPI
// Estructura: 01-02 (centro), 03-08 (blancos), 09-14 (padrón), 15 (DV), 16-75 (5 bloques de 12), 76-78 (blancos), 79-80 (B3)
function buildRegistro80(params: {
  centro: number | null | undefined; // 01-02
  padronRaw: string; // "123456-7" o "1234567"
  codigos: { codigo: string; importe: Prisma.Decimal | string | number | null }[]; // máx 5 por línea
}): string {
  // 01-02: Centro (exactamente 2 dígitos)
  let centroStr = '00';
  if (params.centro != null) {
    const numStr = String(Math.floor(Number(params.centro))).replace(/\D/g, '');
    if (numStr) {
      centroStr = numStr.slice(-2).padStart(2, '0');
    }
  }

  // 03-08: Blancos (6 espacios)
  const blancos1 = '      ';

  // 09-14: Padrón (6 dígitos)
  const { base6, dv } = splitPadronDV(params.padronRaw);
  const padronStr = base6.replace(/\D/g, '').padStart(6, '0').slice(-6);

  // 15: Dígito verificador (1 dígito)
  const dvStr = dv.replace(/\D/g, '').slice(-1) || '0';

  // 16-75: 5 bloques de 12 caracteres cada uno (3 código + 9 importe)
  const bloques: string[] = [];
  for (let i = 0; i < 5; i++) {
    if (i < params.codigos.length) {
      const c = params.codigos[i];
      // Código: 3 caracteres (alfabético + 2 numéricos)
      let cod = String(c.codigo || '').trim().toUpperCase().substring(0, 3).padEnd(3, ' ');
      // Importe: 9 dígitos (7 enteros + 2 decimales, sin punto)
      let imp = '000000000';
      if (c.importe != null) {
        const num = new Prisma.Decimal(String(c.importe));
        const fixed = num.toFixed(2);
        imp = fixed.replace('.', '').padStart(9, '0').substring(0, 9);
      }
      bloques.push((cod + imp).substring(0, 12));
    } else {
      bloques.push('            '); // 12 espacios
    }
  }

  // 76-78: Blancos (3 espacios)
  const blancos2 = '   ';

  // 79-80: B3 (2 caracteres)
  const final = 'B3';

  // Construir línea concatenando exactamente 80 caracteres
  const parts = [
    centroStr.substring(0, 2),    // 01-02: 2
    blancos1.substring(0, 6),     // 03-08: 6
    padronStr.substring(0, 6),    // 09-14: 6
    dvStr.substring(0, 1),        // 15: 1
    bloques[0].substring(0, 12),  // 16-27: 12
    bloques[1].substring(0, 12),  // 28-39: 12
    bloques[2].substring(0, 12),  // 40-51: 12
    bloques[3].substring(0, 12),  // 52-63: 12
    bloques[4].substring(0, 12),  // 64-75: 12
    blancos2.substring(0, 3),     // 76-78: 3
    final.substring(0, 2),        // 79-80: 2
  ];

  const linea = parts.join('');

  // Debug: verificar longitud
  const len = linea.length;
  if (len !== 80) {
    console.error(`[buildRegistro80] ERROR: línea tiene ${len} caracteres (debe ser 80)`, {
      partes: parts.map((p, i) => `${i}:${p.length}`),
      total: parts.reduce((sum, p) => sum + p.length, 0),
    });
  }

  // Retornar exactamente 80 caracteres
  return linea.length === 80 ? linea : linea.substring(0, 80);
}

// Deriva un identificador corto de 6 chars para el archivo (si no hay campo dedicado)
function deriveOrg6(organizacionId: string, nombre?: string | null): string {
  // Priorizamos nombre si existe; sino el propio ID de la organización
  const base = (nombre ?? organizacionId ?? 'ORG').toUpperCase();
  const compact = base.replace(/[^A-Z0-9]/g, '');
  return compact.slice(0, 6).padEnd(6, 'X');
}

// Calcula la fechaCorte (UTC) a partir de "YYYY-MM" + diaCorte (clamp al último día del mes)
function fechaCorteFromPeriodo(periodo: string, diaCorte: number): Date {
  const [y, m] = periodo.split('-').map(Number);
  if (!y || !m) throw new Error('Periodo inválido (YYYY-MM)');
  // día 0 del mes siguiente = último día del mes actual
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Math.max(1, diaCorte), lastDay);
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0, 0));
}

// ======================= Service =======================

@Injectable()
export class NovedadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movimientos: MovimientosService,
    private readonly contabilidad: ContabilidadService,
  ) { }

  // Lee día de corte (si hay NovedadCalendario) o usa default=10
  private async getCorteDia(organizacionId: string, fechaEvento: Date): Promise<number> {
    try {
      const yyyyMM = `${fechaEvento.getUTCFullYear()}-${String(
        fechaEvento.getUTCMonth() + 1,
      ).padStart(2, '0')}`;
      const cfg = await this.prisma.novedadCalendario.findUnique({
        where: { organizacionId_periodo: { organizacionId, periodo: yyyyMM } },
        select: { diaCorte: true },
      });
      if (cfg?.diaCorte) return cfg.diaCorte;
    } catch {
      /* ignore */
    }
    return 10;
  }

  // === API p/ servicios de dominio: encolar evento de novedad ===
  async queueEvento(input: {
    organizacionId: string;
    tipo: string;
    afiliadoId: bigint | number;
    padronId?: bigint | number | null;
    canal?: string | null;
    conceptoId?: bigint | number | null;
    importe?: string | number | Prisma.Decimal | null;
    ocurridoEn?: Date;
    referenciaId?: bigint | number | null;
    observacion?: string | null;
  }) {
    const afiliadoId = BigInt(input.afiliadoId);
    const padronId = input.padronId != null ? BigInt(input.padronId) : undefined;
    const conceptoId = input.conceptoId != null ? BigInt(input.conceptoId) : undefined;
    const referenciaId = input.referenciaId != null ? BigInt(input.referenciaId) : undefined;
    const ocurridoEn = input.ocurridoEn ?? new Date();

    const corteDia = await this.getCorteDia(input.organizacionId, ocurridoEn);
    const periodoDestino = resolverPeriodoDestino(ocurridoEn, corteDia);

    await this.prisma.novedadPendiente.create({
      data: {
        organizacionId: input.organizacionId,
        periodoDestino,
        tipo: input.tipo,
        afiliadoId,
        padronId: padronId ?? null,
        canal: input.canal ?? null,
        conceptoId: conceptoId ?? null,
        importe: input.importe != null ? new Prisma.Decimal(String(input.importe)) : null,
        referenciaId: referenciaId ?? null,
        observacion: input.observacion ?? null,
        ocurridoEn,
      },
    });

    // ⬇️⬇️⬇️ ADITIVO: actualizar/crear la fila de resumen por padrón/periodo
    if (
      input.canal &&
      padronId != null &&
      (input.canal === 'J17' ||
        input.canal === 'J22' ||
        input.canal === 'J38' ||
        input.canal === 'K16')
    ) {
      const canal = input.canal;
      const esBaja = (input.tipo ?? '').endsWith('_BAJA');
      const valor = esBaja ? 0 : (input.importe ?? 0);

      await this.upsertResumenPadron({
        organizacionId: input.organizacionId,
        periodoDestino,
        padronId,
        ocurridoEn,
        canal,
        valor,
      });
    }
    // ⬆️⬆️⬆️ ADITIVO
  }

  // === Genera novedades automáticamente desde pendientes y manuales para un período/sistema ===
  // Genera el TXT y guarda en NovedadGenerada
  async generarNovedades(
    organizacionId: string,
    periodo: string,
    sistema: 'ES' | 'SG',
    opts?: { generadoPor?: string; onDuplicate?: 'error' | 'replace' },
  ): Promise<{ id: bigint; periodo: string; sistema: string; archivoNombre: string; totalRegistros: number; totalImporte: string }> {
    // Verificar si ya existe una generación para este período/sistema
    const existente = await this.prisma.novedadGenerada.findUnique({
      where: {
        organizacionId_periodo_sistema: { organizacionId, periodo, sistema },
      },
    });

    if (existente) {
      if (opts?.onDuplicate === 'replace') {
        await this.prisma.$transaction([
          this.prisma.novedadGeneradaItem.deleteMany({
            where: { novedadGeneradaId: existente.id },
          }),
          this.prisma.novedadGenerada.delete({ where: { id: existente.id } }),
        ]);
      } else {
        throw new Error(`Ya existe una generación de novedades para ${periodo}/${sistema}`);
      }
    }

    // Obtener novedades pendientes para este período
    const pendientes = await this.prisma.novedadPendiente.findMany({
      where: { organizacionId, periodoDestino: periodo },
      orderBy: { id: 'asc' },
    });

    // Obtener padrones relacionados (si hay padronId)
    const padronIds = pendientes
      .map((p) => p.padronId)
      .filter((id): id is bigint => id != null);
    const padronesMap = new Map<bigint, { padron: string | null; centro: number | null; sistema: string | null }>();
    if (padronIds.length > 0) {
      const padrones = await this.prisma.padron.findMany({
        where: { id: { in: padronIds }, organizacionId },
        select: { id: true, padron: true, centro: true, sistema: true },
      });
      for (const p of padrones) {
        padronesMap.set(p.id, { padron: p.padron, centro: p.centro, sistema: p.sistema });
      }
    }

    // Obtener novedades manuales para este período
    const manuales = await this.prisma.novedad.findMany({
      where: { organizacionId, periodo },
      include: {
        padron: true,
      },
      orderBy: { id: 'asc' },
    });

    // Combinar y filtrar por sistema
    const todasLasNovedades = [
      ...pendientes.map((p) => {
        const padron = p.padronId ? padronesMap.get(p.padronId) : null;
        return {
          tipo: 'pendiente' as const,
          afiliadoId: p.afiliadoId,
          padronId: p.padronId,
          padron: padron ? { padron: padron.padron, centro: padron.centro, sistema: padron.sistema } : null,
          padronRaw: padron?.padron ?? '',
          centro: padron?.centro ?? null,
          codigo: (p.canal ?? '').slice(0, 3),
          importe: p.importe ?? new Prisma.Decimal(0),
        };
      }),
      ...manuales.map((m) => ({
        tipo: 'manual' as const,
        afiliadoId: m.afiliadoId,
        padronId: m.padronId,
        padron: m.padron,
        padronRaw: m.padronRaw,
        centro: m.centro,
        codigo: m.codigo.slice(0, 3),
        importe: m.importe,
      })),
    ].filter((n) => {
      const pref = sistemaToDpiPrefix(n.padron?.sistema ?? null);
      return pref === sistema;
    });

    // Agrupar por padrón para generar el TXT
    const porPadron = new Map<
      string,
      {
        centro?: number | null;
        padronRaw: string;
        padronId: bigint | null;
        codigos: { codigo: string; importe: Prisma.Decimal }[];
      }
    >();

    for (const n of todasLasNovedades) {
      const key = String(n.padronId ?? 'sin-padron');
      if (!porPadron.has(key)) {
        porPadron.set(key, {
          centro: n.centro,
          padronRaw: n.padronRaw,
          padronId: n.padronId,
          codigos: [],
        });
      }
      const bucket = porPadron.get(key)!;
      bucket.codigos.push({ codigo: n.codigo, importe: n.importe });
    }

    // Generar líneas del TXT
    const lineas: string[] = [];
    for (const { centro, padronRaw, codigos } of porPadron.values()) {
      for (let i = 0; i < codigos.length; i += 5) {
        const slice = codigos.slice(i, i + 5);
        lineas.push(buildRegistro80({ centro, padronRaw, codigos: slice }));
      }
      if (codigos.length === 0) {
        lineas.push(buildRegistro80({ centro, padronRaw, codigos: [] }));
      }
    }

    const contenido = lineas.join('\r\n') + '\r\n';

    // Calcular totales
    const totalImporte = todasLasNovedades.reduce(
      (sum, n) => sum.plus(n.importe),
      new Prisma.Decimal(0),
    );
    const totalRegistros = lineas.length;

    // Nombre del archivo
    const org = await this.prisma.organizacion.findUnique({
      where: { id: organizacionId },
      select: { nombre: true },
    });
    const org6 = deriveOrg6(organizacionId, org?.nombre);
    const archivoNombre = `${sistema}${org6}.${mesAbrev(periodo)}`;

    // Crear NovedadGenerada con items
    const novedadGenerada = await this.prisma.novedadGenerada.create({
      data: {
        organizacionId,
        periodo,
        sistema,
        archivoNombre,
        archivoContenido: contenido,
        totalRegistros,
        totalImporte,
        generadoPor: opts?.generadoPor ?? null,
        items: {
          create: todasLasNovedades.map((n) => ({
            organizacionId,
            afiliadoId: n.afiliadoId,
            padronId: n.padronId,
            padronRaw: n.padronRaw,
            centro: n.centro,
            codigo: n.codigo,
            importe: n.importe,
          })),
        },
      },
      select: {
        id: true,
        periodo: true,
        sistema: true,
        archivoNombre: true,
        totalRegistros: true,
        totalImporte: true,
      },
    });

    return {
      id: novedadGenerada.id,
      periodo: novedadGenerada.periodo,
      sistema: novedadGenerada.sistema,
      archivoNombre: novedadGenerada.archivoNombre,
      totalRegistros: novedadGenerada.totalRegistros,
      totalImporte: novedadGenerada.totalImporte.toString(),
    };
  }

  // === Descarga el TXT de una NovedadGenerada ===
  async descargarTxtGenerado(
    organizacionId: string,
    novedadGeneradaId: bigint | number,
  ): Promise<{ nombre: string; contenido: string }> {
    const gen = await this.prisma.novedadGenerada.findFirst({
      where: { id: BigInt(novedadGeneradaId), organizacionId },
    });
    if (!gen) throw new Error('Generación de novedades no encontrada');

    return { nombre: gen.archivoNombre, contenido: gen.archivoContenido };
  }

  // === Lista las generaciones de novedades ===
  async listarNovedadesGeneradas(
    organizacionId: string,
    params: {
      periodo?: string;
      sistema?: 'ES' | 'SG' | '';
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(params.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20)));
    const skip = (page - 1) * limit;

    const where: Prisma.NovedadGeneradaWhereInput = {
      organizacionId,
      ...(params.periodo ? { periodo: params.periodo } : {}),
      ...(params.sistema && (params.sistema === 'ES' || params.sistema === 'SG')
        ? { sistema: params.sistema }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.novedadGenerada.findMany({
        where,
        orderBy: [{ periodo: 'desc' }, { sistema: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.novedadGenerada.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: String(r.id),
        periodo: r.periodo,
        sistema: r.sistema,
        archivoNombre: r.archivoNombre,
        totalRegistros: r.totalRegistros,
        totalImporte: r.totalImporte.toString(),
        generadoPor: r.generadoPor,
        generadoEn: r.generadoEn.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  // === Elimina una generación de novedades ===
  async eliminarNovedadGenerada(organizacionId: string, novedadGeneradaId: bigint | number) {
    const gen = await this.prisma.novedadGenerada.findFirst({
      where: { id: BigInt(novedadGeneradaId), organizacionId },
    });
    if (!gen) throw new Error('Generación de novedades no encontrada');

    // Eliminar items primero (cascade debería hacerlo, pero lo hacemos explícitamente)
    await this.prisma.$transaction([
      this.prisma.novedadGeneradaItem.deleteMany({
        where: { novedadGeneradaId: gen.id },
      }),
      this.prisma.novedadGenerada.delete({
        where: { id: gen.id },
      }),
    ]);

    return { id: String(gen.id), eliminado: true };
  }

  // ======================= Reglas de negocio (encolado) =======================

  /**
   * ALTA de afiliado (se registra al crear su primer padrón, o explícitamente si así lo definen)
   * Regla: J17 siempre “200” en TXT → nosotros guardamos 2.00 (para que formatee a 000000200)
   */
  async registrarAltaAfiliado(params: {
    organizacionId: string;
    afiliadoId: bigint | number;
    padronId?: bigint | number | null; // si la “alta afiliado” se da junto a creación de padrón
    ocurridoEn?: Date;
    observacion?: string | null;
  }) {
    await this.queueEvento({
      organizacionId: params.organizacionId,
      tipo: 'PADRON_ALTA',
      afiliadoId: params.afiliadoId,
      padronId: params.padronId ?? null,
      canal: 'J17',
      importe: 2, // 2.00 → "000000200"
      ocurridoEn: params.ocurridoEn,
      observacion: params.observacion ?? 'Alta afiliado (J17=200)',
    });
  }

  /**
   * BAJA de afiliado (soft o hard): J17 = 0.00
   */
  async registrarBajaAfiliado(params: {
    organizacionId: string;
    afiliadoId: bigint | number;
    padronId?: bigint | number | null;
    ocurridoEn?: Date;
    observacion?: string | null;
  }) {
    await this.queueEvento({
      organizacionId: params.organizacionId,
      tipo: 'PADRON_BAJA',
      afiliadoId: params.afiliadoId,
      padronId: params.padronId ?? null,
      canal: 'J17',
      importe: 0, // 0.00 → "000000000"
      ocurridoEn: params.ocurridoEn,
      observacion: params.observacion ?? 'Baja afiliado (J17=0)',
    });
  }

  /**
   * ALTA de coseguro: J22 = precio vigente del coseguro
   * Busca ReglaPrecioCoseguro vigente a la fecha (primero la más reciente por vigenteDesde)
   */
  async registrarAltaCoseguro(params: {
    organizacionId: string;
    afiliadoId: bigint | number;
    padronId: bigint | number; // donde se imputa el coseguro
    ocurridoEn?: Date;
    observacion?: string | null;
  }) {
    const fecha = params.ocurridoEn ?? new Date();
    // Buscar regla vigente
    const regla = await this.prisma.reglaPrecioCoseguro.findFirst({
      where: {
        organizacionId: params.organizacionId,
        activo: true,
        vigenteDesde: { lte: fecha },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }],
      },
      orderBy: [{ vigenteDesde: 'desc' }, { id: 'desc' }],
    });
    const importe = regla?.precioBase ?? new Prisma.Decimal(0);

    await this.queueEvento({
      organizacionId: params.organizacionId,
      tipo: 'COSEGURO_ALTA',
      afiliadoId: params.afiliadoId,
      padronId: params.padronId,
      canal: 'J22',
      importe, // p.ej. 3500.00 → "000350000"
      ocurridoEn: fecha,
      observacion: params.observacion ?? 'Alta coseguro (J22)',
    });
  }

  /**
   * BAJA de coseguro: J22 = 0.00
   */
  async registrarBajaCoseguro(params: {
    organizacionId: string;
    afiliadoId: bigint | number;
    padronId: bigint | number;
    ocurridoEn?: Date;
    observacion?: string | null;
  }) {
    await this.queueEvento({
      organizacionId: params.organizacionId,
      tipo: 'COSEGURO_BAJA',
      afiliadoId: params.afiliadoId,
      padronId: params.padronId,
      canal: 'J22',
      importe: 0,
      ocurridoEn: params.ocurridoEn,
      observacion: params.observacion ?? 'Baja coseguro (J22=0)',
    });
  }

  /**
   * ALTA de colaterales: J38 = suma de precios de colaterales (según reglas vigentes por parentesco y cantidad)
   * Si ya traés el total calculado, podés pasarlo por params.total; si no, lo calculamos acá.
   */
  async registrarAltaColaterales(params: {
    organizacionId: string;
    afiliadoId: bigint | number;
    padronId: bigint | number;
    ocurridoEn?: Date;
    observacion?: string | null;
    total?: Prisma.Decimal | string | number; // opcional: si ya lo calculaste
  }) {
    const fecha = params.ocurridoEn ?? new Date();
    let total = new Prisma.Decimal(0);

    if (params.total != null) {
      total = new Prisma.Decimal(String(params.total));
    } else {
      // Calculamos total por reglas vigentes según cantidad por parentesco
      // (si querés exactitud por persona, adaptá a tu modelo)
      const colats = await this.prisma.colateral.findMany({
        where: {
          coseguro: { afiliadoId: BigInt(params.afiliadoId) },
          activo: true,
        },
        select: { parentescoId: true },
      });

      // Cantidad por parentesco
      const mapCant = new Map<bigint, number>();
      for (const c of colats) {
        const k = BigInt(c.parentescoId);
        mapCant.set(k, (mapCant.get(k) ?? 0) + 1);
      }

      // Por cada parentesco, buscamos regla por tramo de cantidad vigente y sumamos precioTotal
      for (const [parentescoId, cant] of mapCant.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const regla = (await this.prisma.reglaPrecioColateral.findFirst({
          where: {
            organizacionId: params.organizacionId,
            parentescoId: parentescoId,
            activo: true,
            vigenteDesde: { lte: fecha },
            OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }],
            cantidadDesde: { lte: cant },
            OR_2: [{ cantidadHasta: null }, { cantidadHasta: { gte: cant } }],
          },
          orderBy: [{ vigenteDesde: 'desc' }, { id: 'desc' }],
        } as any)) as { precioTotal?: Prisma.Decimal } | null; // alias OR_2 hack

        if (regla?.precioTotal) {
          total = total.plus(regla.precioTotal);
        }
      }
    }

    await this.queueEvento({
      organizacionId: params.organizacionId,
      tipo: 'COLATERAL_ALTA',
      afiliadoId: params.afiliadoId,
      padronId: params.padronId,
      canal: 'J38',
      importe: total, // p.ej. 10000.00 → "001000000"
      ocurridoEn: fecha,
      observacion: params.observacion ?? 'Alta colaterales (J38)',
    });
  }

  /**
   * BAJA de colateral(es): J38 = 0.00
   * Si la baja es parcial (1 de varios), podés registrar un “MODIF_COLATERAL” con el nuevo total.
   */
  async registrarBajaColaterales(params: {
    organizacionId: string;
    afiliadoId: bigint | number;
    padronId: bigint | number;
    ocurridoEn?: Date;
    observacion?: string | null;
  }) {
    await this.queueEvento({
      organizacionId: params.organizacionId,
      tipo: 'COLATERAL_BAJA',
      afiliadoId: params.afiliadoId,
      padronId: params.padronId,
      canal: 'J38',
      importe: 0,
      ocurridoEn: params.ocurridoEn,
      observacion: params.observacion ?? 'Baja colaterales (J38=0)',
    });
  }

  /**
   * MODIFICACIÓN de precio de coseguro: J22 = nuevo precio
   */
  async registrarModifCoseguro(params: {
    organizacionId: string;
    afiliadoId: bigint | number;
    padronId: bigint | number;
    nuevoPrecio: Prisma.Decimal | string | number;
    ocurridoEn?: Date;
    observacion?: string | null;
  }) {
    await this.queueEvento({
      organizacionId: params.organizacionId,
      tipo: 'COSEGURO_MODIF',
      afiliadoId: params.afiliadoId,
      padronId: params.padronId,
      canal: 'J22',
      importe: params.nuevoPrecio,
      ocurridoEn: params.ocurridoEn,
      observacion: params.observacion ?? 'Modificación precio coseguro (J22)',
    });
  }

  /**
   * MODIFICACIÓN de precio de colaterales: J38 = nuevo total
   */
  async registrarModifColaterales(params: {
    organizacionId: string;
    afiliadoId: bigint | number;
    padronId: bigint | number;
    nuevoTotal: Prisma.Decimal | string | number;
    ocurridoEn?: Date;
    observacion?: string | null;
  }) {
    await this.queueEvento({
      organizacionId: params.organizacionId,
      tipo: 'COLATERAL_MODIF',
      afiliadoId: params.afiliadoId,
      padronId: params.padronId,
      canal: 'J38',
      importe: params.nuevoTotal,
      ocurridoEn: params.ocurridoEn,
      observacion: params.observacion ?? 'Modificación precio colaterales (J38)',
    });
  }

  // ======================= J17 por PADRÓN =======================
  // ALTAS Y BAJAS POR PADRON; ESTE METODO ES EL USADO!!
  /** Alta de PADRÓN ⇒ J17 = 2.00 (se formatea a ...000000200 en TXT) */
  async registrarAltaPadronJ17(params: {
    organizacionId: string;
    afiliadoId: bigint | number;
    padronId: bigint | number;
    ocurridoEn?: Date;
    observacion?: string | null;
  }) {
    await this.queueEvento({
      organizacionId: params.organizacionId,
      tipo: 'PADRON_ALTA',
      afiliadoId: params.afiliadoId,
      padronId: params.padronId,
      canal: 'J17',
      importe: 2, // 2.00
      ocurridoEn: params.ocurridoEn ?? new Date(),
      observacion: params.observacion ?? 'Alta de padrón (J17=200)',
    });
  }

  /** Baja de PADRÓN ⇒ J17 = 0.00 */
  async registrarBajaPadronJ17(params: {
    organizacionId: string;
    afiliadoId: bigint | number;
    padronId: bigint | number;
    ocurridoEn?: Date;
    observacion?: string | null;
  }) {
    await this.queueEvento({
      organizacionId: params.organizacionId,
      tipo: 'PADRON_BAJA',
      afiliadoId: params.afiliadoId,
      padronId: params.padronId,
      canal: 'J17',
      importe: 0, // 0.00
      ocurridoEn: params.ocurridoEn ?? new Date(),
      observacion: params.observacion ?? 'Baja de padrón (J17=0)',
    });
  }

  // ===================== MONITOR (pendientes) =====================

  async listarPendientes(
    organizacionId: string,
    params: {
      from?: string;
      to?: string;
      tipos?: ('J17' | 'J22' | 'J38')[];
      accion?: 'alta' | 'baja' | 'modif' | '';
      q?: string;
      page?: number;
      limit?: number;
      sort?: string;
    },
  ) {
    const page = Math.max(1, Number(params.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20)));
    const skip = (page - 1) * limit;

    // Rango de fechas (inclusive)
    let desde: Date | undefined;
    let hasta: Date | undefined;
    if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)) {
      desde = new Date(params.from + 'T00:00:00.000Z');
    }
    if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
      hasta = new Date(params.to + 'T23:59:59.999Z');
    }

    // Acción → por sufijo del campo "tipo"
    let accionWhere: Prisma.NovedadPendienteWhereInput | undefined;
    if (params.accion === 'alta') accionWhere = { tipo: { endsWith: '_ALTA' } };
    if (params.accion === 'baja') accionWhere = { tipo: { endsWith: '_BAJA' } };
    if (params.accion === 'modif') accionWhere = { tipo: { contains: 'MODIF' } };

    // Tipo (canal Jxx)
    const tipoWhere: Prisma.NovedadPendienteWhereInput | undefined =
      params.tipos && params.tipos.length ? { canal: { in: params.tipos as string[] } } : undefined;

    // Orden
    let orderBy: Prisma.NovedadPendienteOrderByWithRelationInput = { ocurridoEn: 'desc' };
    if (params.sort) {
      const [field, dir] = params.sort.split(':');
      if (field && (dir === 'asc' || dir === 'desc') && ['ocurridoEn', 'id'].includes(field)) {
        orderBy = { [field]: dir } as any;
      }
    }

    // ---------- Filtro texto (q) resolviendo IDs sin relaciones ----------
    const q = (params.q ?? '').trim();
    const orFilters: Prisma.NovedadPendienteWhereInput[] = [];

    if (q) {
      const afiWhere: Prisma.AfiliadoWhereInput = /^\d+$/.test(q)
        ? { organizacionId, dni: BigInt(q) }
        : {
          organizacionId,
          OR: [
            { apellido: { contains: q, mode: 'insensitive' } },
            { nombre: { contains: q, mode: 'insensitive' } },
          ],
        };

      const [afiliados, padrones] = await Promise.all([
        this.prisma.afiliado.findMany({ where: afiWhere, select: { id: true } }),
        this.prisma.padron.findMany({
          where: { organizacionId, padron: { contains: q, mode: 'insensitive' } },
          select: { id: true },
        }),
      ]);

      const afiIds = afiliados.map((a) => a.id);
      const padIds = padrones.map((p) => p.id);

      if (afiIds.length) orFilters.push({ afiliadoId: { in: afiIds } });
      if (padIds.length) orFilters.push({ padronId: { in: padIds } });

      if (!afiIds.length && !padIds.length) {
        return { items: [], total: 0, page, limit };
      }
    }

    const where: Prisma.NovedadPendienteWhereInput = {
      organizacionId,
      ...(desde || hasta
        ? { ocurridoEn: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
        : {}),
      ...(tipoWhere ?? {}),
      ...(accionWhere ?? {}),
      ...(orFilters.length ? { OR: orFilters } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.novedadPendiente.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.novedadPendiente.count({ where }),
    ]);

    // Enriquecer con afiliado/padrón (lookups tipados)
    type AfiliadoRow = {
      id: bigint;
      apellido: string | null;
      nombre: string | null;
      dni: bigint | null;
    };
    type PadronRow = { id: bigint; padron: string | null };

    const afiIdsAll = Array.from(new Set(rows.map((r) => r.afiliadoId)));
    const padIdsAll = Array.from(
      new Set(rows.map((r) => r.padronId).filter((x): x is bigint => x != null)),
    );

    const afis: AfiliadoRow[] = afiIdsAll.length
      ? await this.prisma.afiliado.findMany({
        where: { id: { in: afiIdsAll }, organizacionId },
        select: { id: true, apellido: true, nombre: true, dni: true },
      })
      : [];
    const pads: PadronRow[] = padIdsAll.length
      ? await this.prisma.padron.findMany({
        where: { id: { in: padIdsAll }, organizacionId },
        select: { id: true, padron: true },
      })
      : [];

    const afiMap = new Map<string, AfiliadoRow>();
    for (const a of afis) afiMap.set(a.id.toString(), a);
    const padMap = new Map<string, PadronRow>();
    for (const p of pads) padMap.set(p.id.toString(), p);

    const mapped = rows.map((it) => {
      const accion = it.tipo?.endsWith('_ALTA')
        ? 'alta'
        : it.tipo?.endsWith('_BAJA')
          ? 'baja'
          : it.tipo?.includes('MODIF')
            ? 'modif'
            : '';

      const a = afiMap.get(it.afiliadoId.toString());
      const p = it.padronId != null ? padMap.get(it.padronId.toString()) : undefined;

      return {
        id: String(it.id),
        tipo: it.canal ?? null, // 'J17' | 'J22' | 'J38'
        accion, // 'alta' | 'baja' | 'modif' | ''
        importe: it.importe ? Number(it.importe) : 0,
        ocurridoEn: it.ocurridoEn?.toISOString() ?? null,
        origen: it.observacion ?? it.tipo ?? null,
        afiliado: a
          ? {
            id: a.id.toString(),
            dni: a.dni != null ? a.dni.toString() : null,
            apellido: a.apellido ?? null,
            nombre: a.nombre ?? null,
          }
          : null,
        padron: p ? { id: p.id.toString(), padron: p.padron ?? null } : null,
      };
    });

    return { items: mapped, total, page, limit };
  }

  async resumenPendientes(
    organizacionId: string,
    params: {
      from?: string;
      to?: string;
      tipos?: ('J17' | 'J22' | 'J38')[];
      accion?: 'alta' | 'baja' | 'modif' | '';
      q?: string;
    },
  ) {
    // Rango
    let desde: Date | undefined;
    let hasta: Date | undefined;
    if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)) {
      desde = new Date(params.from + 'T00:00:00.000Z');
    }
    if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
      hasta = new Date(params.to + 'T23:59:59.999Z');
    }

    // Acción
    let accionWhere: Prisma.NovedadPendienteWhereInput | undefined;
    if (params.accion === 'alta') accionWhere = { tipo: { endsWith: '_ALTA' } };
    if (params.accion === 'baja') accionWhere = { tipo: { endsWith: '_BAJA' } };
    if (params.accion === 'modif') accionWhere = { tipo: { contains: 'MODIF' } };

    // Tipo
    const tipoWhere: Prisma.NovedadPendienteWhereInput | undefined =
      params.tipos && params.tipos.length ? { canal: { in: params.tipos as string[] } } : undefined;

    // Búsqueda por texto -> IDs
    const q = (params.q ?? '').trim();
    const orFilters: Prisma.NovedadPendienteWhereInput[] = [];

    if (q) {
      const afiWhere: Prisma.AfiliadoWhereInput = /^\d+$/.test(q)
        ? { organizacionId, dni: BigInt(q) }
        : {
          organizacionId,
          OR: [
            { apellido: { contains: q, mode: 'insensitive' } },
            { nombre: { contains: q, mode: 'insensitive' } },
          ],
        };

      const [afiliados, padrones] = await Promise.all([
        this.prisma.afiliado.findMany({ where: afiWhere, select: { id: true } }),
        this.prisma.padron.findMany({
          where: { organizacionId, padron: { contains: q, mode: 'insensitive' } },
          select: { id: true },
        }),
      ]);

      const afiIds = afiliados.map((a) => a.id);
      const padIds = padrones.map((p) => p.id);

      if (afiIds.length) orFilters.push({ afiliadoId: { in: afiIds } });
      if (padIds.length) orFilters.push({ padronId: { in: padIds } });

      if (!afiIds.length && !padIds.length) {
        return {
          totales: { cantidad: 0, importe: 0 },
          porTipo: [],
          porAccion: [
            { accion: 'alta', cantidad: 0 },
            { accion: 'baja', cantidad: 0 },
            { accion: 'modif', cantidad: 0 },
          ],
        };
      }
    }

    const whereBase: Prisma.NovedadPendienteWhereInput = {
      organizacionId,
      ...(desde || hasta
        ? { ocurridoEn: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
        : {}),
      ...(tipoWhere ?? {}),
      ...(accionWhere ?? {}),
      ...(orFilters.length ? { OR: orFilters } : {}),
    };

    // Totales
    const agg = await this.prisma.novedadPendiente.aggregate({
      where: whereBase,
      _count: { _all: true },
      _sum: { importe: true },
    });

    // Por tipo (canal)
    const porTipoRaw = await this.prisma.novedadPendiente.groupBy({
      by: ['canal'],
      where: whereBase,
      _count: { _all: true },
      _sum: { importe: true },
    });

    // Por acción
    const [altaCnt, bajaCnt, modifCnt] = await Promise.all([
      this.prisma.novedadPendiente.count({ where: { ...whereBase, tipo: { endsWith: '_ALTA' } } }),
      this.prisma.novedadPendiente.count({ where: { ...whereBase, tipo: { endsWith: '_BAJA' } } }),
      this.prisma.novedadPendiente.count({ where: { ...whereBase, tipo: { contains: 'MODIF' } } }),
    ]);

    const totales = {
      cantidad: agg._count._all,
      importe: agg._sum.importe ? Number(agg._sum.importe) : 0,
    };

    const porTipo = porTipoRaw
      .filter((r) => !!r.canal)
      .map((r) => ({
        tipo: r.canal as 'J17' | 'J22' | 'J38',
        cantidad: r._count._all,
        importe: r._sum.importe ? Number(r._sum.importe) : 0,
      }));

    const porAccion = [
      { accion: 'alta', cantidad: altaCnt },
      { accion: 'baja', cantidad: bajaCnt },
      { accion: 'modif', cantidad: modifCnt },
    ];

    return { totales, porTipo, porAccion };
  }

  // ADITIVO: dentro de NovedadesService
  private async upsertResumenPadron(input: {
    organizacionId: string;
    periodoDestino: string; // 'YYYY-MM'
    padronId: bigint | number;
    ocurridoEn: Date;
    canal: 'J17' | 'J22' | 'J38' | 'K16';
    valor: Prisma.Decimal | number | string; // set final (0 para bajas)
  }) {
    const pad = await this.prisma.padron.findUnique({
      where: { id: BigInt(input.padronId) },
      select: { centro: true, sistema: true },
    });

    // guardamos el prefijo DPI ('ES'/'SG') en "sistema" del resumen
    const sistemaDpi = sistemaToDpiPrefix(pad?.sistema ?? null);

    // seteo de la columna según el canal
    const setCols: Record<string, Prisma.Decimal> = {};
    const val = new Prisma.Decimal(String(input.valor));
    if (input.canal === 'J17') setCols.j17 = val;
    if (input.canal === 'J22') setCols.j22 = val;
    if (input.canal === 'J38') setCols.j38 = val;
    if (input.canal === 'K16') setCols.k16 = val;

    await this.prisma.novedadPendientePadron.upsert({
      where: {
        npp_unique_org_period_padron: {
          organizacionId: input.organizacionId,
          periodoDestino: input.periodoDestino,
          padronId: BigInt(input.padronId),
        },
      },
      create: {
        organizacionId: input.organizacionId,
        periodoDestino: input.periodoDestino,
        padronId: BigInt(input.padronId),
        centro: pad?.centro ?? null,
        sistema: sistemaDpi,
        ocurridoEn: input.ocurridoEn,
        ...setCols,
      },
      update: {
        // mantenemos datos utilitarios actualizados
        centro: pad?.centro ?? null,
        sistema: sistemaDpi,
        ocurridoEn: input.ocurridoEn,
        ...setCols,
        // updatedAt se maneja solo por @updatedAt
      },
    });
  }

  // ADITIVO: lista "una fila por padrón/periodo" con columnas J17/J22/J38/K16 + sistema/centro
  async listarPendientesResumen(
    organizacionId: string,
    params: {
      periodo?: string;
      sistema?: 'ES' | 'SG' | '';
      page?: number;
      limit?: number;
      q?: string;
    },
  ) {
    const periodo = params.periodo || null;
    const sistema =
      params.sistema && (params.sistema === 'ES' || params.sistema === 'SG')
        ? params.sistema
        : undefined;

    const page = Math.max(1, Number(params.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20)));
    const skip = (page - 1) * limit;

    const q = (params.q ?? '').trim();

    const where: Prisma.NovedadPendientePadronWhereInput = {
      organizacionId,
      ...(periodo ? { periodoDestino: periodo } : {}),
      ...(sistema ? { sistema } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.novedadPendientePadron.findMany({
        where,
        orderBy: [{ periodoDestino: 'desc' }, { padronId: 'asc' }],
        skip,
        take: limit,
      }),
      this.prisma.novedadPendientePadron.count({ where }),
    ]);

    // Lookup de padrón (y filtro por q si viene texto)
    const padIds = rows.map((r) => r.padronId);
    const pads = padIds.length
      ? await this.prisma.padron.findMany({
        where: {
          id: { in: padIds },
          organizacionId,
          ...(q ? { padron: { contains: q, mode: 'insensitive' } } : {}),
        },
        select: { id: true, padron: true, centro: true, sistema: true },
      })
      : [];
    const padMap = new Map(pads.map((p) => [p.id.toString(), p]));

    const items = rows
      .map((r) => {
        // si vino q y este padrón no matcheó, lo salteamos
        if (q && !padMap.get(r.padronId.toString())) return null;
        const p = padMap.get(r.padronId.toString());
        return {
          periodo: r.periodoDestino,
          padronId: r.padronId.toString(),
          padron: p?.padron ?? null,
          centro: p?.centro ?? r.centro ?? null,
          sistema: (p?.sistema ? sistemaToDpiPrefix(p.sistema) : (r.sistema ?? null)) as
            | 'ES'
            | 'SG'
            | null,
          J17: r.j17 != null ? Number(r.j17) : null,
          J22: r.j22 != null ? Number(r.j22) : null,
          J38: r.j38 != null ? Number(r.j38) : null,
          K16: r.k16 != null ? Number(r.k16) : null,
          ocurridoEn: r.ocurridoEn?.toISOString() ?? null,
        };
      })
      .filter(Boolean) as Array<{
        periodo: string;
        padronId: string;
        padron: string | null;
        centro: number | null;
        sistema: 'ES' | 'SG' | null;
        J17: number | null;
        J22: number | null;
        J38: number | null;
        K16: number | null;
        ocurridoEn: string | null;
      }>;

    return { items, total, page, limit };
  }

  // ADITIVO: genera archivo DPI desde el resumen (por periodo + sistema)
  // usa helpers buildRegistro80 / deriveOrg6 / mesAbrev
  async construirTxtDesdeResumen(
    organizacionId: string,
    periodo: string, // 'YYYY-MM'
    sistema: 'ES' | 'SG',
  ) {
    const rows = await this.prisma.novedadPendientePadron.findMany({
      where: { organizacionId, periodoDestino: periodo, sistema },
      orderBy: { padronId: 'asc' },
    });

    // lookup padrones
    const pads = rows.length
      ? await this.prisma.padron.findMany({
        where: { id: { in: rows.map((r) => r.padronId) }, organizacionId },
        select: { id: true, padron: true, centro: true },
      })
      : [];
    const padMap = new Map(pads.map((p) => [p.id.toString(), p]));

    const lineas: string[] = [];
    for (const r of rows) {
      const p = padMap.get(r.padronId.toString());
      const centro = p?.centro ?? r.centro ?? null;
      const padronRaw = p?.padron ?? '';

      // en la MISMA línea podés incluir hasta 5 códigos; hoy usamos 4 fijos
      const codigos: { codigo: string; importe: Prisma.Decimal | number | string | null }[] = [];
      if (r.j17 != null) codigos.push({ codigo: 'J17', importe: r.j17 });
      if (r.j22 != null) codigos.push({ codigo: 'J22', importe: r.j22 });
      if (r.j38 != null) codigos.push({ codigo: 'J38', importe: r.j38 });
      if (r.k16 != null) codigos.push({ codigo: 'K16', importe: r.k16 });

      if (codigos.length === 0) {
        lineas.push(buildRegistro80({ centro, padronRaw, codigos: [] })); // mantiene formato
        continue;
      }
      // si mañana agregás más códigos, sigue en bloques de 5
      for (let i = 0; i < codigos.length; i += 5) {
        lineas.push(buildRegistro80({ centro, padronRaw, codigos: codigos.slice(i, i + 5) }));
      }
    }

    const contenido = lineas.join('\r\n') + '\r\n';

    const org = await this.prisma.organizacion.findUnique({
      where: { id: organizacionId },
      select: { id: true, nombre: true },
    });
    const nombre = `${sistema}${deriveOrg6(organizacionId, org?.nombre)}.${mesAbrev(periodo)}`;
    return { nombre, contenido };
  }

  // ========== Precio global de COSEGURO (J22) ==========

  /** Devuelve la regla vigente a una fecha (por default hoy) */
  async getPrecioCoseguroVigente(organizacionId: string, fecha?: Date) {
    const f = fecha ?? new Date();
    const regla = await this.prisma.reglaPrecioCoseguro.findFirst({
      where: {
        organizacionId,
        activo: true,
        vigenteDesde: { lte: f },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: f } }],
      },
      orderBy: [{ vigenteDesde: 'desc' }, { id: 'desc' }],
    });

    if (!regla) return null;

    return {
      id: String(regla.id),
      precio: Number(regla.precioBase),
      vigenteDesde: regla.vigenteDesde?.toISOString() ?? null,
      vigenteHasta: regla.vigenteHasta?.toISOString() ?? null,
    };
  }

  /**
   * Crea una nueva regla de precio de coseguro (J22) y opcionalmente
   * impacta (encola COSEGURO_MODIF) a TODOS los padrones de imputación con coseguro activo.
   *
   * - Cierra la regla anterior (vigenteHasta = día anterior) y la marca inactiva.
   * - Crea la nueva regla (activo=true, vigenteDesde=fecha).
   * - Si impactarPadrones=true:
   *    * actualiza Padron.j22 en los padrones de imputación
   *    * borra pendientes J22 del mismo periodo (si dedupe='replace')
   *    * encola COSEGURO_MODIF por cada padrón de imputación con coseguro
   */
  async actualizarPrecioCoseguroGlobal(input: {
    organizacionId: string;
    nuevoPrecio: Prisma.Decimal | number | string;
    vigenteDesde?: Date; // default: hoy
    impactarPadrones?: boolean; // default: true
    dedupe?: 'keep' | 'replace'; // default: 'replace'
  }) {
    const organizacionId = input.organizacionId;
    const fecha = input.vigenteDesde ?? new Date();
    const nuevoPrecio = new Prisma.Decimal(String(input.nuevoPrecio));
    const impactar = input.impactarPadrones ?? true;
    const dedupe = input.dedupe ?? 'replace';

    // 1) Cerrar regla anterior (si existe)
    const reglaAnterior = await this.prisma.reglaPrecioCoseguro.findFirst({
      where: { organizacionId, activo: true },
      orderBy: [{ vigenteDesde: 'desc' }, { id: 'desc' }],
    });

    let prevCerradas = 0;
    if (reglaAnterior) {
      const diaAntes = new Date(
        Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate() - 1, 0, 0, 0),
      );
      await this.prisma.reglaPrecioCoseguro.update({
        where: { id: reglaAnterior.id },
        data: { activo: false, vigenteHasta: diaAntes },
      });
      prevCerradas = 1;
    }

    // 2) Crear nueva regla vigente
    const nueva = await this.prisma.reglaPrecioCoseguro.create({
      data: {
        organizacionId,
        activo: true,
        vigenteDesde: fecha,
        vigenteHasta: null,
        precioBase: nuevoPrecio,
      },
    });

    // 3) Impactar a todos los padrones de imputación con coseguro activo
    let afectados = 0;
    let encolados = 0;
    let periodoDestino = '';

    if (impactar) {
      // Tomamos únicamente los que tengan padrón de imputación de coseguro
      const cosegurosActivos = await this.prisma.coseguroAfiliado.findMany({
        where: {
          organizacionId,
          estado: 'activo',
          imputacionPadronIdCoseguro: { not: null },
        },
        select: { afiliadoId: true, imputacionPadronIdCoseguro: true },
      });

      afectados = cosegurosActivos.length;

      // IDs de padrones a actualizar (deduplicados)
      const padronIds = Array.from(
        new Set(
          cosegurosActivos
            .map((c) => c.imputacionPadronIdCoseguro!)
            .filter((x): x is bigint => x != null),
        ),
      );

      // periodo destino (mismo para todos por fecha de ocurrido)
      const corteDia = await this.getCorteDia(organizacionId, fecha);
      periodoDestino = resolverPeriodoDestino(fecha, corteDia);

      // (opcional) dedupe en pendientes J22 del mismo periodo
      if (dedupe === 'replace' && padronIds.length) {
        await this.prisma.novedadPendiente.deleteMany({
          where: {
            organizacionId,
            periodoDestino,
            canal: 'J22',
            padronId: { in: padronIds },
          },
        });
      }

      // Actualizamos el valor j22 en los padrones de imputación
      if (padronIds.length) {
        await this.prisma.padron.updateMany({
          where: { organizacionId, id: { in: padronIds } },
          data: { j22: nuevoPrecio },
        });
      }

      // Encolado de COSEGURO_MODIF (J22 = nuevoPrecio) para cada padrón de imputación
      const CHUNK = 500;
      for (let i = 0; i < cosegurosActivos.length; i += CHUNK) {
        const chunk = cosegurosActivos.slice(i, i + CHUNK);
        for (const c of chunk) {
          if (!c.imputacionPadronIdCoseguro) continue;
          await this.queueEvento({
            organizacionId,
            tipo: 'COSEGURO_MODIF',
            afiliadoId: c.afiliadoId,
            padronId: c.imputacionPadronIdCoseguro,
            canal: 'J22',
            importe: nuevoPrecio,
            ocurridoEn: fecha,
            observacion: `Modificación global J22 → ${nuevoPrecio.toFixed(2)}`,
          });
          encolados++;
        }
      }
    }

    return {
      reglaNuevaId: String(nueva.id),
      prevCerradas,
      afectados,
      encolados,
      periodoDestino,
      precio: Number(nuevoPrecio),
      vigenteDesde: fecha.toISOString(),
    };
  }

  // Lee el corte configurado para un periodo (o 10 si no hay fila)
  async getCortePeriodo(
    organizacionId: string,
    periodo: string,
  ): Promise<{ periodo: string; diaCorte: number }> {
    const cfg = await this.prisma.novedadCalendario.findUnique({
      where: { organizacionId_periodo: { organizacionId, periodo } },
      select: { diaCorte: true },
    });
    return { periodo, diaCorte: cfg?.diaCorte ?? 10 };
  }

  // Upsert del corte para un periodo
  async setCortePeriodo(
    organizacionId: string,
    periodo: string,
    diaCorte: number,
  ): Promise<{ periodo: string; diaCorte: number }> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      throw new Error('Periodo inválido (YYYY-MM)');
    }
    const d = Number(diaCorte);
    if (!Number.isInteger(d) || d < 1 || d > 31) {
      throw new Error('diaCorte inválido (1..31)');
    }

    const fechaCorte = fechaCorteFromPeriodo(periodo, d);

    await this.prisma.novedadCalendario.upsert({
      where: { organizacionId_periodo: { organizacionId, periodo } },
      create: { organizacionId, periodo, diaCorte: d, fechaCorte },
      update: { diaCorte: d, fechaCorte },
    });

    return { periodo, diaCorte: d };
  }

  // Conviene para pruebas: resolver periodo por fecha usando el corte actual
  async resolverPeriodoPorFecha(
    organizacionId: string,
    fechaISO: string,
  ): Promise<{
    fechaEvento: string;
    corteDia: number;
    periodoBase: string;
    periodoDestino: string;
  }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) {
      throw new Error('Fecha inválida (YYYY-MM-DD)');
    }
    const fecha = new Date(fechaISO + 'T00:00:00Z');
    const corte = await this.getCorteDia(organizacionId, fecha); // usa el helper ya existente
    const y = fecha.getUTCFullYear();
    const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const base = `${y}-${m}`;
    const destino = resolverPeriodoDestino(fecha, corte);
    return { fechaEvento: fechaISO, corteDia: corte, periodoBase: base, periodoDestino: destino };
  }

  // ======================= CRUD Novedades Manuales =======================

  // === Crear novedad manual ===
  async crearNovedadManual(input: {
    organizacionId: string;
    periodo: string;
    afiliadoId: bigint | number;
    padronId?: bigint | number | null;
    padronRaw: string;
    centro?: number | null;
    codigo: string; // Código de descuento (ej: "P40", "J17", "J22")
    importe: Prisma.Decimal | string | number;
    observacion?: string | null;
    creadoPor?: string | null;
  }) {
    const afiliadoId = BigInt(input.afiliadoId);
    const padronId = input.padronId != null ? BigInt(input.padronId) : null;

    const novedad = await this.prisma.novedad.create({
      data: {
        organizacionId: input.organizacionId,
        periodo: input.periodo,
        afiliadoId,
        padronId,
        padronRaw: input.padronRaw,
        centro: input.centro ?? null,
        codigo: input.codigo.slice(0, 3).toUpperCase(),
        importe: new Prisma.Decimal(String(input.importe)),
        observacion: input.observacion ?? null,
        creadoPor: input.creadoPor ?? null,
      },
    });

    return {
      id: String(novedad.id),
      periodo: novedad.periodo,
      afiliadoId: String(novedad.afiliadoId),
      padronId: novedad.padronId ? String(novedad.padronId) : null,
      padronRaw: novedad.padronRaw,
      centro: novedad.centro,
      codigo: novedad.codigo,
      importe: novedad.importe.toString(),
      observacion: novedad.observacion,
      creadoPor: novedad.creadoPor,
      creadoEn: novedad.creadoEn.toISOString(),
    };
  }

  // === Listar novedades manuales ===
  async listarNovedadesManuales(
    organizacionId: string,
    params: {
      periodo?: string;
      codigo?: string;
      q?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(params.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(params.limit ?? 20)));
    const skip = (page - 1) * limit;

    const q = (params.q ?? '').trim();
    const orFilters: Prisma.NovedadWhereInput[] = [];

    if (q) {
      const afiWhere: Prisma.AfiliadoWhereInput = /^\d+$/.test(q)
        ? { organizacionId, dni: BigInt(q) }
        : {
          organizacionId,
          OR: [
            { apellido: { contains: q, mode: 'insensitive' } },
            { nombre: { contains: q, mode: 'insensitive' } },
          ],
        };

      const [afiliados, padrones] = await Promise.all([
        this.prisma.afiliado.findMany({ where: afiWhere, select: { id: true } }),
        this.prisma.padron.findMany({
          where: { organizacionId, padron: { contains: q, mode: 'insensitive' } },
          select: { id: true },
        }),
      ]);

      const afiIds = afiliados.map((a) => a.id);
      const padIds = padrones.map((p) => p.id);

      if (afiIds.length) orFilters.push({ afiliadoId: { in: afiIds } });
      if (padIds.length) orFilters.push({ padronId: { in: padIds } });
      orFilters.push({ padronRaw: { contains: q, mode: 'insensitive' } });
    }

    const where: Prisma.NovedadWhereInput = {
      organizacionId,
      ...(params.periodo ? { periodo: params.periodo } : {}),
      ...(params.codigo ? { codigo: params.codigo.toUpperCase() } : {}),
      ...(orFilters.length ? { OR: orFilters } : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.novedad.findMany({
        where,
        include: {
          afiliado: { select: { id: true, apellido: true, nombre: true, dni: true } },
          padron: { select: { id: true, padron: true } },
        },
        orderBy: { creadoEn: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.novedad.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: String(r.id),
        periodo: r.periodo,
        afiliado: r.afiliado
          ? {
            id: String(r.afiliado.id),
            apellido: r.afiliado.apellido,
            nombre: r.afiliado.nombre,
            dni: r.afiliado.dni ? String(r.afiliado.dni) : null,
          }
          : null,
        padron: r.padron
          ? { id: String(r.padron.id), padron: r.padron.padron }
          : { id: null, padron: r.padronRaw },
        padronRaw: r.padronRaw,
        centro: r.centro,
        codigo: r.codigo,
        importe: r.importe.toString(),
        observacion: r.observacion,
        creadoPor: r.creadoPor,
        creadoEn: r.creadoEn.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  // === Actualizar novedad manual ===
  async actualizarNovedadManual(
    organizacionId: string,
    novedadId: bigint | number,
    input: {
      padronId?: bigint | number | null;
      padronRaw?: string;
      centro?: number | null;
      codigo?: string;
      importe?: Prisma.Decimal | string | number;
      observacion?: string | null;
    },
  ) {
    const novedad = await this.prisma.novedad.findFirst({
      where: { id: BigInt(novedadId), organizacionId },
    });
    if (!novedad) throw new Error('Novedad no encontrada');

    const padronId = input.padronId !== undefined ? (input.padronId != null ? BigInt(input.padronId) : null) : undefined;

    const actualizada = await this.prisma.novedad.update({
      where: { id: BigInt(novedadId) },
      data: {
        ...(padronId !== undefined ? { padronId } : {}),
        ...(input.padronRaw !== undefined ? { padronRaw: input.padronRaw } : {}),
        ...(input.centro !== undefined ? { centro: input.centro ?? null } : {}),
        ...(input.codigo !== undefined ? { codigo: input.codigo.slice(0, 3).toUpperCase() } : {}),
        ...(input.importe !== undefined ? { importe: new Prisma.Decimal(String(input.importe)) } : {}),
        ...(input.observacion !== undefined ? { observacion: input.observacion ?? null } : {}),
      },
    });

    return {
      id: String(actualizada.id),
      periodo: actualizada.periodo,
      codigo: actualizada.codigo,
      importe: actualizada.importe.toString(),
      actualizadoEn: actualizada.actualizadoEn.toISOString(),
    };
  }

  // === Eliminar novedad manual ===
  async eliminarNovedadManual(organizacionId: string, novedadId: bigint | number) {
    const novedad = await this.prisma.novedad.findFirst({
      where: { id: BigInt(novedadId), organizacionId },
    });
    if (!novedad) throw new Error('Novedad no encontrada');

    await this.prisma.novedad.delete({ where: { id: BigInt(novedadId) } });

    return { id: String(novedadId), eliminado: true };
  }

  // ===================== CONCILIACIÓN DE NOVEDADES =====================

  /**
   * Procesa un archivo TXT de conciliación de cómputos y actualiza los padrones con los montos efectivamente descontados.
   * 
   * Formato de línea esperado:
   * SUP196650948RUMILLA GRACIELA     8213613672512J17004842543J22003500000J38000500000K16008746100
   * 
   * Estructura:
   * - Posiciones 0-2: "SUP" (ignorar)
   * - Posiciones 3-4: Centro (ej: "19")
   * - Posiciones 5-11: Padrón con DV (ej: "6650948" -> "665094-8")
   * - Luego: Nombre (variable, termina antes del tipo DNI)
   * - Tipo DNI: 1 dígito (ej: "8")
   * - DNI: variable (ej: "21361367")
   * - Período: 4 dígitos (ej: "2512" = diciembre 2025 -> "2025-12")
   * - Códigos y montos: bloques de 12 caracteres cada uno (3 código + 9 monto)
   *   - Código: 3 caracteres (ej: "J17")
   *   - Monto: 9 dígitos, 7 enteros + 2 decimales sin punto (ej: "004842543" = 4842.43)
   */
  async procesarConciliacion(
    organizacionId: string,
    archivoBuffer: Buffer,
    periodo?: string, // Si no se proporciona, se extrae de la primera línea
  ): Promise<{
    procesadas: number;
    errores: number;
    periodo: string;
    detalles: Array<{ padron: string; centro?: number; codigos: string[] }>;
  }> {
    const contenido = archivoBuffer.toString('latin1'); // Usar latin1 para preservar caracteres especiales
    const lineas = contenido.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lineas.length === 0) {
      throw new Error('El archivo está vacío');
    }

      // Extraer período de la primera línea si no se proporcionó
      let periodoProcesado = periodo;
      if (!periodoProcesado) {
        const primeraLinea = lineas[0];
        // Buscar el período (4 dígitos antes de los códigos J/K seguidos de 2 dígitos)
        // Formato: YYMM donde YY es el año (ej: 25 = 2025) y MM es el mes (ej: 12 = diciembre)
        const periodoMatch = primeraLinea.match(/(\d{4})(?=[JK]\d{2})/);
        if (periodoMatch) {
          const periodoRaw = periodoMatch[1]; // ej: "2512" = diciembre 2025
          const anio = periodoRaw.substring(0, 2); // ej: "25"
          const mes = periodoRaw.substring(2, 4); // ej: "12"
          // Convertir YY a YYYY (asumiendo 2000-2099)
          const anioCompleto = `20${anio}`;
          periodoProcesado = `${anioCompleto}-${mes}`;
        } else {
          throw new Error('No se pudo extraer el período del archivo. Por favor, indíquelo manualmente.');
        }
      }

    // Validar formato de período
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodoProcesado)) {
      throw new Error('Período inválido. Formato esperado: YYYY-MM');
    }

    const detalles: Array<{ padron: string; centro?: number; codigos: string[] }> = [];
    let procesadas = 0;
    let errores = 0;

    // Procesar en lotes pequeños para evitar timeout (máximo 50 líneas por transacción)
    const TAMANO_LOTE = 50;
    const TOTAL_LINEAS = lineas.length;

    for (let i = 0; i < lineas.length; i += TAMANO_LOTE) {
      const lote = lineas.slice(i, i + TAMANO_LOTE);
      
      // Procesar cada lote en una transacción con timeout extendido (60 segundos)
      await this.prisma.$transaction(
        async (tx) => {
          for (const linea of lote) {
        try {
          // Parsear línea
          // SUP + centro(2) + padrón(7) + nombre + tipoDNI(1) + DNI + período(4) + códigos
          if (!linea.startsWith('SUP')) {
            console.warn(`Línea ignorada (no comienza con SUP): ${linea.substring(0, 50)}`);
            errores++;
            continue;
          }

          // Extraer centro (posiciones 3-4)
          const centroStr = linea.substring(3, 5);
          const centro = /^\d{2}$/.test(centroStr) ? Number(centroStr) : undefined;

          // Extraer padrón (posiciones 5-11 = 7 dígitos)
          const padronRaw = linea.substring(5, 12);
          if (!/^\d{7}$/.test(padronRaw)) {
            console.warn(`Padrón inválido en línea: ${linea.substring(0, 50)}`);
            errores++;
            continue;
          }

          // Formatear padrón: los primeros 6 dígitos + "-" + último dígito (DV)
          const padronBase = padronRaw.substring(0, 6);
          const padronDV = padronRaw.substring(6, 7);
          const padronFormateado = `${padronBase}-${padronDV}`;

          // Buscar el padrón
          const padron = await tx.padron.findFirst({
            where: { organizacionId, padron: padronFormateado },
          });

          if (!padron) {
            console.warn(`Padrón no encontrado: ${padronFormateado}`);
            errores++;
            continue;
          }

          // Extraer códigos y montos
          // Buscar desde el final hacia atrás: los códigos vienen antes del final
          // Buscamos bloques de 12 caracteres (3 código + 9 monto) que empiezan con J o K seguido de 2 dígitos
          const codigosMontos: Array<{ codigo: string; monto: string }> = [];
          const regexCodigo = /([JK]\d{2})(\d{9})/g;
          let match;
          
          // Buscar todos los códigos en la línea
          while ((match = regexCodigo.exec(linea)) !== null) {
            const codigo = match[1]; // ej: "J17"
            const montoStr = match[2]; // ej: "004842543"
            codigosMontos.push({ codigo, monto: montoStr });
          }

          if (codigosMontos.length === 0) {
            console.warn(`No se encontraron códigos en línea: ${linea.substring(0, 50)}`);
            errores++;
            continue;
          }

          // Preparar actualización de campos
          const updateData: {
            j17?: Prisma.Decimal;
            j22?: Prisma.Decimal;
            j38?: Prisma.Decimal;
            k16?: Prisma.Decimal;
          } = {};

          const codigosProcesados: string[] = [];

          for (const { codigo, monto } of codigosMontos) {
            // Convertir monto: 9 dígitos (7 enteros + 2 decimales) -> Decimal
            // ej: "004842543" = 0048425.43 = 48,425.43
            // ej: "003500000" = 0035000.00 = 35,000.00
            const enteroStr = monto.substring(0, 7);
            const decimalStr = monto.substring(7, 9);
            // Parsear como número y luego crear Decimal para evitar problemas con ceros a la izquierda
            const montoNumerico = parseFloat(`${enteroStr}.${decimalStr}`);
            const montoDecimal = new Prisma.Decimal(montoNumerico.toFixed(2));

            // Actualizar según el código
            switch (codigo.toUpperCase()) {
              case 'J17':
                updateData.j17 = montoDecimal;
                codigosProcesados.push(`J17: ${montoDecimal.toFixed(2)}`);
                break;
              case 'J22':
                updateData.j22 = montoDecimal;
                codigosProcesados.push(`J22: ${montoDecimal.toFixed(2)}`);
                break;
              case 'J38':
                updateData.j38 = montoDecimal;
                codigosProcesados.push(`J38: ${montoDecimal.toFixed(2)}`);
                break;
              case 'K16':
                updateData.k16 = montoDecimal;
                codigosProcesados.push(`K16: ${montoDecimal.toFixed(2)}`);
                break;
              default:
                console.warn(`Código no reconocido: ${codigo}`);
            }
          }

          // Actualizar padrón
          await tx.padron.update({
            where: { id: padron.id },
            data: updateData,
          });

          detalles.push({
            padron: padronFormateado,
            centro,
            codigos: codigosProcesados,
          });
          procesadas++;
        } catch (error) {
          console.error(`Error procesando línea: ${linea.substring(0, 50)}`, error);
          errores++;
        }
      }
        },
        {
          maxWait: 60000, // 60 segundos máximo de espera
          timeout: 60000, // 60 segundos de timeout por transacción
        },
      );
    }

    return {
      procesadas,
      errores,
      periodo: periodoProcesado,
      detalles,
    };
  }

  /**
   * Procesa la conciliación con callbacks para progreso en tiempo real
   */
  async procesarConciliacionConProgreso(
    organizacionId: string,
    archivoBuffer: Buffer,
    periodo?: string,
    onProgreso?: (progreso: {
      procesadas: number;
      errores: number;
      total: number;
      porcentaje: number;
      ultimoPadron?: string;
      detallesParciales: Array<{ padron: string; centro?: number; codigos: string[] }>;
      erroresDetallados: Array<{ padron?: string; motivo: string; linea?: string }>;
    }) => void,
  ): Promise<{
    procesadas: number;
    errores: number;
    periodo: string;
    detalles: Array<{ padron: string; centro?: number; codigos: string[] }>;
    erroresDetallados: Array<{ padron?: string; motivo: string; linea?: string }>;
  }> {
    const contenido = archivoBuffer.toString('latin1');
    const lineas = contenido.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lineas.length === 0) {
      throw new Error('El archivo está vacío');
    }

    let periodoProcesado = periodo;
    if (!periodoProcesado) {
      const primeraLinea = lineas[0];
      const periodoMatch = primeraLinea.match(/(\d{4})(?=[JK]\d{2})/);
      if (periodoMatch) {
        const periodoRaw = periodoMatch[1];
        const anio = periodoRaw.substring(0, 2);
        const mes = periodoRaw.substring(2, 4);
        const anioCompleto = `20${anio}`;
        periodoProcesado = `${anioCompleto}-${mes}`;
      } else {
        throw new Error('No se pudo extraer el período del archivo. Por favor, indíquelo manualmente.');
      }
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodoProcesado)) {
      throw new Error('Período inválido. Formato esperado: YYYY-MM');
    }

    const detalles: Array<{ padron: string; centro?: number; codigos: string[] }> = [];
    const erroresDetallados: Array<{ padron?: string; motivo: string; linea?: string }> = [];
    let procesadas = 0;
    let errores = 0;
    const TOTAL_LINEAS = lineas.length;
    const TAMANO_LOTE = 50;

    for (let i = 0; i < lineas.length; i += TAMANO_LOTE) {
      const lote = lineas.slice(i, i + TAMANO_LOTE);
      let ultimoPadronProcesado: string | undefined;
      const erroresLote: Array<{ padron?: string; motivo: string; linea?: string }> = [];

      await this.prisma.$transaction(
        async (tx) => {
          for (const linea of lote) {
            try {
              if (!linea.startsWith('SUP')) {
                const motivo = `Línea no comienza con SUP`;
                erroresLote.push({ motivo, linea: linea.substring(0, 80) });
                errores++;
                continue;
              }

              const centroStr = linea.substring(3, 5);
              const centro = /^\d{2}$/.test(centroStr) ? Number(centroStr) : undefined;

              const padronRaw = linea.substring(5, 12);
              let padronFormateado: string | undefined;
              
              if (!/^\d{7}$/.test(padronRaw)) {
                const motivo = `Padrón inválido (no tiene 7 dígitos): ${padronRaw}`;
                erroresLote.push({ motivo, linea: linea.substring(0, 80) });
                errores++;
                continue;
              }

              const padronBase = padronRaw.substring(0, 6);
              const padronDV = padronRaw.substring(6, 7);
              padronFormateado = `${padronBase}-${padronDV}`;

              const padron = await tx.padron.findFirst({
                where: { organizacionId, padron: padronFormateado },
              });

              if (!padron) {
                const motivo = `Padrón no encontrado en la base de datos`;
                erroresLote.push({ padron: padronFormateado, motivo, linea: linea.substring(0, 80) });
                errores++;
                continue;
              }

              const codigosMontos: Array<{ codigo: string; monto: string }> = [];
              const regexCodigo = /([JK]\d{2})(\d{9})/g;
              let match;

              while ((match = regexCodigo.exec(linea)) !== null) {
                const codigo = match[1];
                const montoStr = match[2];
                codigosMontos.push({ codigo, monto: montoStr });
              }

              if (codigosMontos.length === 0) {
                const motivo = `No se encontraron códigos (J17, J22, J38, K16) en la línea`;
                erroresLote.push({ padron: padronFormateado, motivo, linea: linea.substring(0, 80) });
                errores++;
                continue;
              }

              const updateData: {
                j17?: Prisma.Decimal;
                j22?: Prisma.Decimal;
                j38?: Prisma.Decimal;
                k16?: Prisma.Decimal;
              } = {};

              const codigosProcesados: string[] = [];
              
              // Mapeo de códigos a conceptos
              const codigoToConcepto: Record<string, string> = {
                'J17': 'CUOTA_SOC',
                'J22': 'COSEGURO',
                'J38': 'ADIC_COL',
                'K16': 'ORDEN_CREDITO',
              };

              // Calcular total del pago para crear un único Pago
              let totalPago = new Prisma.Decimal(0);
              const itemsPago: Array<{ codigo: string; monto: Prisma.Decimal; concepto: string }> = [];

              for (const { codigo, monto } of codigosMontos) {
                const enteroStr = monto.substring(0, 7);
                const decimalStr = monto.substring(7, 9);
                const montoNumerico = parseFloat(`${enteroStr}.${decimalStr}`);
                const montoDecimal = new Prisma.Decimal(montoNumerico.toFixed(2));

                switch (codigo.toUpperCase()) {
                  case 'J17':
                    updateData.j17 = montoDecimal;
                    codigosProcesados.push(`J17: ${montoDecimal.toFixed(2)}`);
                    totalPago = totalPago.add(montoDecimal);
                    itemsPago.push({ codigo: 'J17', monto: montoDecimal, concepto: 'CUOTA_SOC' });
                    break;
                  case 'J22':
                    updateData.j22 = montoDecimal;
                    codigosProcesados.push(`J22: ${montoDecimal.toFixed(2)}`);
                    totalPago = totalPago.add(montoDecimal);
                    itemsPago.push({ codigo: 'J22', monto: montoDecimal, concepto: 'COSEGURO' });
                    break;
                  case 'J38':
                    updateData.j38 = montoDecimal;
                    codigosProcesados.push(`J38: ${montoDecimal.toFixed(2)}`);
                    totalPago = totalPago.add(montoDecimal);
                    itemsPago.push({ codigo: 'J38', monto: montoDecimal, concepto: 'ADIC_COL' });
                    break;
                  case 'K16':
                    updateData.k16 = montoDecimal;
                    codigosProcesados.push(`K16: ${montoDecimal.toFixed(2)}`);
                    totalPago = totalPago.add(montoDecimal);
                    itemsPago.push({ codigo: 'K16', monto: montoDecimal, concepto: 'ORDEN_CREDITO' });
                    break;
                  default:
                    console.warn(`Código no reconocido: ${codigo}`);
                }
              }

              // Actualizar padrón con los montos
              await tx.padron.update({
                where: { id: padron.id },
                data: updateData,
              });

              // Si hay montos a procesar, crear pago y movimientos
              if (totalPago.gt(0) && itemsPago.length > 0) {
                // Buscar o crear una caja virtual para nómina
                // (el schema requiere cajaId, pero para nómina no tenemos caja física)
                let cajaNomina = await tx.caja.findFirst({
                  where: {
                    organizacionId,
                    sede: 'NOMINA', // Caja especial para nómina
                    estado: 'cerrada', // Buscamos una cerrada, o creamos nueva
                  },
                  orderBy: { fechaCierre: 'desc' },
                });

                // Si no existe, crear una caja virtual para nómina
                if (!cajaNomina) {
                  cajaNomina = await tx.caja.create({
                    data: {
                      organizacionId,
                      sede: 'NOMINA',
                      fechaApertura: new Date(),
                      fechaCierre: new Date(), // Cerrada automáticamente
                      estado: 'cerrada',
                    },
                  });
                }

                // 1. Crear Pago con origen='nomina'
                const pago = await tx.pago.create({
                  data: {
                    organizacionId,
                    afiliadoId: padron.afiliadoId,
                    cajaId: cajaNomina.id,
                    total: totalPago,
                    numeroRecibo: null,
                    origen: 'nomina',
                  },
                });

                // 2. Crear MétodoPago (nómina)
                await tx.metodoPago.create({
                  data: {
                    pagoId: pago.id,
                    metodo: 'nomina',
                    monto: totalPago,
                    ref: `Conciliación ${periodoProcesado}`,
                  },
                });

                // 3. Procesar cada código: crear movimientos y para K16 cancelar órdenes de crédito
                for (const item of itemsPago) {
                  const conceptoNombre = item.codigo === 'J17' ? 'Descuento cuota societaria'
                    : item.codigo === 'J22' ? 'Descuento coseguro'
                    : item.codigo === 'J38' ? 'Descuento colateral'
                    : item.codigo === 'K16' ? 'Descuento crédito'
                    : `Descuento ${item.codigo}`;

                  let ordenIdAplicada: bigint | null = null;
                  let cuotaIdAplicada: bigint | null = null;
                  const ordenesCanceladas: Array<{ ordenId: bigint; descripcion: string }> = [];

                  // Para K16: cancelar órdenes de crédito en orden FIFO
                  // Crear UN SOLO movimiento con el total del K16 y describir aplicaciones en concepto
                  if (item.codigo === 'K16') {
                    // Buscar órdenes de crédito pendientes del afiliado, ordenadas por fecha (FIFO)
                    const ordenesCredito = await tx.ordenCredito.findMany({
                      where: {
                        organizacionId,
                        afiliadoId: padron.afiliadoId,
                        estado: { in: ['pendiente', 'en_curso'] },
                        saldoTotal: { gt: 0 },
                      },
                      include: {
                        cuotas: {
                          where: {
                            estado: { in: ['pendiente', 'generada', 'parcialmente_pagada'] },
                            saldo: { gt: 0 },
                          },
                          orderBy: [
                            { periodoVenc: 'asc' },
                            { numero: 'asc' },
                          ],
                        },
                      },
                      orderBy: { fechaAlta: 'asc' },
                    });

                    let montoRestante = item.monto;
                    const aplicaciones: Array<{ ordenId: bigint; cuotaId: bigint; cuotaNum: number; monto: Prisma.Decimal }> = [];

                    // Recorrer órdenes de crédito en orden FIFO y aplicar pagos
                    for (const orden of ordenesCredito) {
                      if (montoRestante.lte(0)) break;

                      for (const cuota of orden.cuotas) {
                        if (montoRestante.lte(0)) break;

                        const saldoCuota = new Prisma.Decimal(cuota.saldo);
                        const montoAplicar = montoRestante.gt(saldoCuota) ? saldoCuota : montoRestante;
                        const nuevoSaldo = saldoCuota.minus(montoAplicar);
                        const nuevoCancelado = new Prisma.Decimal(cuota.cancelado).add(montoAplicar);

                        // Actualizar cuota
                        await tx.ordenCreditoCuota.update({
                          where: { id: cuota.id },
                          data: {
                            saldo: nuevoSaldo,
                            cancelado: nuevoCancelado,
                            estado: nuevoSaldo.lte(0.01) ? 'pagada' : 'parcialmente_pagada',
                            fechaCancelacion: nuevoSaldo.lte(0.01) ? new Date() : cuota.fechaCancelacion,
                          },
                        });

                        // Registrar la aplicación para el detalle
                        aplicaciones.push({
                          ordenId: orden.id,
                          cuotaId: cuota.id,
                          cuotaNum: cuota.numero,
                          monto: montoAplicar,
                        });

                        montoRestante = montoRestante.minus(montoAplicar);

                        // Registrar orden afectada
                        if (!ordenesCanceladas.find((o) => o.ordenId.toString() === orden.id.toString())) {
                          ordenesCanceladas.push({ ordenId: orden.id, descripcion: orden.descripcion });
                        }

                        // Actualizar saldo total de la orden
                        const todasLasCuotas = await tx.ordenCreditoCuota.findMany({
                          where: { ordenId: orden.id },
                        });
                        const saldoTotalOrden = todasLasCuotas.reduce(
                          (sum, c) => sum.add(new Prisma.Decimal(c.saldo)),
                          new Prisma.Decimal(0),
                        );

                        await tx.ordenCredito.update({
                          where: { id: orden.id },
                          data: {
                            saldoTotal: saldoTotalOrden,
                            estado: saldoTotalOrden.lte(0.01) ? 'cancelada' : 'en_curso',
                          },
                        });
                      }
                    }

                    // Construir concepto descriptivo con las aplicaciones
                    let conceptoK16 = 'Descuento crédito K16';
                    if (aplicaciones.length > 0) {
                      const detalleAplicaciones = aplicaciones
                        .map((a) => `ORD#${a.ordenId} cuota ${a.cuotaNum}: $${a.monto.toFixed(2)}`)
                        .join(' | ');
                      conceptoK16 += ` → ${detalleAplicaciones}`;
                    }
                    if (montoRestante.gt(0.01)) {
                      conceptoK16 += ` | Saldo a favor: $${montoRestante.toFixed(2)}`;
                    }

                    // Crear UN SOLO movimiento con el total del K16
                    // Vinculamos a la primera orden/cuota si hay, para poder expandir el detalle
                    const primeraAplicacion = aplicaciones[0];
                    const movK16 = await this.movimientos.postMovimiento({
                      tx,
                      organizacionId,
                      afiliadoId: padron.afiliadoId,
                      padronId: padron.id,
                      fecha: new Date(),
                      naturaleza: 'credito',
                      origen: 'nomina',
                      concepto: conceptoK16,
                      importe: Number(item.monto), // Total del K16
                      ordenId: primeraAplicacion?.ordenId ?? null,
                      cuotaId: primeraAplicacion?.cuotaId ?? null,
                      pagoId: pago.id,
                      periodoContable: periodoProcesado,
                      // K16 SÍ afecta el saldo (cancela deuda real de órdenes de crédito)
                    });

                    // Generar asiento contable para K16 (si hay mapeo configurado)
                    await this.contabilidad.crearAsientoNomina(tx, {
                      organizacionId,
                      conceptoCodigo: 'K16',
                      monto: Number(item.monto),
                      padron: padronFormateado,
                      periodoContable: periodoProcesado,
                      movimientoId: movK16.id,
                    });

                    continue; // No crear movimiento genérico al final
                  }

                  // Para J17, J22, J38: crear movimiento INFORMATIVO (no afecta saldo)
                  // Estos descuentos pagan deudas "implícitas" que NO registramos como débito
                  // Solo sirven para saber que al afiliado le están descontando
                  const movInfo = await this.movimientos.postMovimiento({
                    tx,
                    organizacionId,
                    afiliadoId: padron.afiliadoId,
                    padronId: padron.id,
                    fecha: new Date(),
                    naturaleza: 'credito',
                    origen: 'nomina',
                    concepto: conceptoNombre,
                    importe: Number(item.monto),
                    pagoId: pago.id,
                    periodoContable: periodoProcesado,
                    afectaSaldo: false, // NO afecta saldo porque no hay deuda previa registrada
                  });

                  // Generar asiento contable (J17, J22, J38) si hay mapeo configurado
                  await this.contabilidad.crearAsientoNomina(tx, {
                    organizacionId,
                    conceptoCodigo: item.codigo,
                    monto: Number(item.monto),
                    padron: padronFormateado,
                    periodoContable: periodoProcesado,
                    movimientoId: movInfo.id,
                  });
                }
              }

              detalles.push({
                padron: padronFormateado,
                centro,
                codigos: codigosProcesados,
              });
              ultimoPadronProcesado = padronFormateado;
              procesadas++;
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              // Intentar extraer el padrón si está disponible en el contexto
              let padronError: string | undefined;
              try {
                const padronRaw = linea.substring(5, 12);
                if (/^\d{7}$/.test(padronRaw)) {
                  const padronBase = padronRaw.substring(0, 6);
                  const padronDV = padronRaw.substring(6, 7);
                  padronError = `${padronBase}-${padronDV}`;
                }
              } catch {
                // Ignorar si no se puede extraer
              }
              
              const motivo = `Error al procesar: ${errorMsg}`;
              erroresLote.push({ 
                padron: padronError, 
                motivo, 
                linea: linea.substring(0, 80) 
              });
              errores++;
              console.error(`Error procesando línea: ${linea.substring(0, 50)}`, error);
            }
          }
        },
        {
          maxWait: 60000,
          timeout: 60000,
        },
      );

      // Agregar errores del lote a la lista total
      erroresDetallados.push(...erroresLote);

      // Notificar progreso después de cada lote
      if (onProgreso) {
        onProgreso({
          procesadas,
          errores,
          total: TOTAL_LINEAS,
          porcentaje: Math.round(((i + lote.length) / TOTAL_LINEAS) * 100),
          ultimoPadron: ultimoPadronProcesado,
          detallesParciales: detalles.slice(Math.max(0, detalles.length - lote.length)),
          erroresDetallados: erroresLote,
        });
      }
    }

    return {
      procesadas,
      errores,
      periodo: periodoProcesado,
      detalles,
      erroresDetallados,
    };
  }
}
