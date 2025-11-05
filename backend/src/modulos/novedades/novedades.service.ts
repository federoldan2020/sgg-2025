import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

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
// Slots: 0 => pos 16-27, slots 1..4 => pos 28-75 (4 bloques de 12)
function buildRegistro80(params: {
  centro: number | null | undefined; // 01-02
  padronRaw: string; // "123456-7" o "1234567"
  codigos: { codigo: string; importe: Prisma.Decimal | string | number | null }[]; // máx 5 por línea
}) {
  const centro2 = padNum(params.centro ?? '', 2); // 01-02
  const blancos_03_08 = ' '.repeat(6); // 03-08

  const { base6, dv } = splitPadronDV(params.padronRaw);
  const padron6 = padNum(base6, 6); // 09-14
  const dv1 = dv.replace(/\D/g, '').slice(-1) || '0'; // 15

  // Construimos hasta 5 slots de 12 chars: [3 cod][9 importe]
  const slots: string[] = [];
  for (let i = 0; i < Math.min(params.codigos.length, 5); i++) {
    const c = params.codigos[i];
    const cod3 = formatCodigo_3(c.codigo);
    const imp9 = formatImporte_9(c.importe);
    slots.push(cod3 + imp9); // 12
  }
  while (slots.length < 5) slots.push(' '.repeat(12));

  const linea =
    centro2 + // 01-02
    blancos_03_08 + // 03-08
    padron6 + // 09-14
    dv1 + // 15
    slots[0] + // 16-27
    slots[1] + // 28-39
    slots[2] + // 40-51
    slots[3] + // 52-63
    slots[4] + // 64-75
    ' '.repeat(3) + // 76-78
    'B3'; // 79-80

  return linea.padEnd(80, ' ').slice(0, 80);
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
  constructor(private readonly prisma: PrismaService) {}

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

  // === Genera lote desde pendientes ===
  async generarLote(
    organizacionId: string,
    periodo: string,
    opts?: { onDuplicate?: 'error' | 'replace' | 'skip' },
  ): Promise<{ id: bigint; periodo: string; estado: string }> {
    const existente = await this.prisma.novedadLote.findFirst({
      where: { organizacionId, periodo },
      select: { id: true },
    });

    if (existente) {
      if (opts?.onDuplicate === 'replace') {
        await this.prisma.$transaction([
          this.prisma.novedadItemDetalle.deleteMany({
            where: { novedadItem: { novedadLoteId: existente.id } },
          }),
          this.prisma.novedadItem.deleteMany({ where: { novedadLoteId: existente.id } }),
          this.prisma.novedadLote.delete({ where: { id: existente.id } }),
        ]);
      } else if (opts?.onDuplicate === 'skip') {
        const full = await this.prisma.novedadLote.findUnique({
          where: { id: existente.id },
          select: { id: true, periodo: true, estado: true },
        });
        if (!full) throw new Error('Lote existente no encontrado');
        return full;
      } else {
        throw new Error(`Ya existe un lote de novedades para ${periodo}`);
      }
    }

    const pendientes = await this.prisma.novedadPendiente.findMany({
      where: { organizacionId, periodoDestino: periodo },
      orderBy: { id: 'asc' },
    });

    const lote = await this.prisma.novedadLote.create({
      data: { organizacionId, periodo, estado: 'enviado' },
      select: { id: true, periodo: true, estado: true },
    });

    // Creamos NovedadItem 1:1 (luego se puede consolidar por padrón/canal)
    for (const p of pendientes) {
      await this.prisma.novedadItem.create({
        data: {
          novedadLoteId: lote.id,
          organizacionId,
          afiliadoId: p.afiliadoId,
          padronId: p.padronId ?? null,
          canal: p.canal ?? '   ', // 3 chars
          conceptoId: p.conceptoId ?? null,
          importeEnviado: p.importe ?? new Prisma.Decimal(0),
          conciliacionEstado: 'pendiente',
        },
      });
    }

    // Limpiar pendientes usados (opcional)
    await this.prisma.novedadPendiente.deleteMany({
      where: { organizacionId, periodoDestino: periodo },
    });

    return lote;
  }

  // === Construye el TXT DPI (por sistema) desde NovedadItem del lote ===
  async construirTxt(organizacionId: string, loteId: bigint | number, sistema: 'ES' | 'SG') {
    const lote = await this.prisma.novedadLote.findFirst({
      where: { id: BigInt(loteId), organizacionId },
      include: {
        items: {
          include: {
            padron: true,
            afiliado: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!lote) throw new Error('Lote no encontrado');

    // Filtrar por sistema usando padron.sistema (ESC->ES, SG/SGR->SG)
    const items = lote.items.filter((it) => {
      const pref = sistemaToDpiPrefix(it.padron?.sistema ?? null);
      return pref === sistema;
    });

    // Agrupar por Padrón => { centro, padronRaw, codigos[] }
    const porPadron = new Map<
      string,
      {
        centro?: number | null;
        padronRaw: string;
        codigos: { codigo: string; importe: Prisma.Decimal | string | number | null }[];
      }
    >();

    for (const it of items) {
      const key = String(it.padronId ?? 'sin-padron');
      const centro = it.padron?.centro ?? null;
      const padronRaw = it.padron?.padron ?? '';
      const codigo = (it.canal ?? '').slice(0, 3); // 3 chars
      const importe = it.importeEnviado;

      if (!porPadron.has(key)) {
        porPadron.set(key, { centro, padronRaw, codigos: [] });
      }
      const bucket = porPadron.get(key)!;
      bucket.codigos.push({ codigo, importe });
    }

    // Por cada padrón, generamos tantas líneas de 80 como se necesiten (máx 5 códigos por línea)
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

    // Nombre del archivo: <ES|SG><ORG6>.<MES3>
    // Derivamos ORG6 de la organización (nombre o id) para no depender de un campo extra
    const org = await this.prisma.organizacion.findUnique({
      where: { id: organizacionId },
      select: { id: true, nombre: true }, // <-- solo campos existentes
    });

    const org6 = deriveOrg6(organizacionId, org?.nombre);
    const nombre = `${sistema}${org6}.${mesAbrev(lote.periodo)}`; // ej: ES3PROVI.AGO

    return { nombre, contenido };
  }

  // === Preview JSON del lote (opcionalmente filtrado por sistema ES|SG) ===
  async previewLote(
    organizacionId: string,
    loteId: bigint | number,
    opts?: { sistema?: 'ES' | 'SG' },
  ) {
    const lote = await this.prisma.novedadLote.findFirst({
      where: { id: BigInt(loteId), organizacionId },
      include: {
        items: {
          include: {
            padron: true,
            afiliado: { select: { id: true, apellido: true, nombre: true, dni: true } },
            concepto: { select: { id: true, codigo: true, nombre: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!lote) throw new Error('Lote no encontrado');

    const itemsFiltrados = opts?.sistema
      ? lote.items.filter((it) => sistemaToDpiPrefix(it.padron?.sistema ?? null) === opts.sistema)
      : lote.items;

    type Cod = { codigo: string; importe: string };
    type Bucket = {
      centro?: number | null;
      padronRaw: string;
      base6: string;
      dv: string;
      sistema?: string | null;
      afiliados: { id: string; dni?: string | number | null; display: string }[];
      codigos: Cod[];
      totalCodigos: string;
    };

    const Decimal = Prisma.Decimal;
    const porPadron = new Map<string, Bucket>();

    for (const it of itemsFiltrados) {
      const key = String(it.padronId ?? 'sin-padron');
      const padronRaw = it.padron?.padron ?? '';
      const { base6, dv } = splitPadronDV(padronRaw);

      if (!porPadron.has(key)) {
        porPadron.set(key, {
          centro: it.padron?.centro ?? null,
          padronRaw,
          base6,
          dv,
          sistema: it.padron?.sistema ?? null,
          afiliados: [],
          codigos: [],
          totalCodigos: '0.00',
        });
      }
      const b = porPadron.get(key)!;

      // Normalizar DNI bigint -> string (o null)
      const dniNorm = it.afiliado?.dni != null ? String(it.afiliado.dni) : null;

      const display =
        [it.afiliado?.apellido, it.afiliado?.nombre].filter(Boolean).join(', ') ||
        String(it.afiliadoId);

      b.afiliados.push({
        id: String(it.afiliadoId),
        dni: dniNorm,
        display,
      });

      const codigo = (it.canal ?? '').slice(0, 3);
      const importe = new Decimal(String(it.importeEnviado ?? 0));
      b.codigos.push({ codigo, importe: importe.toFixed(2) });
      b.totalCodigos = new Decimal(b.totalCodigos).plus(importe).toFixed(2);
    }

    const totales = { ES: '0.00', SG: '0.00', ALL: '0.00' };
    for (const b of porPadron.values()) {
      const pref = sistemaToDpiPrefix(b.sistema ?? null);
      totales.ALL = new Decimal(totales.ALL).plus(b.totalCodigos).toFixed(2);
      if (pref === 'ES') totales.ES = new Decimal(totales.ES).plus(b.totalCodigos).toFixed(2);
      if (pref === 'SG') totales.SG = new Decimal(totales.SG).plus(b.totalCodigos).toFixed(2);
    }

    return {
      lote: { id: String(lote.id), periodo: lote.periodo, estado: lote.estado },
      filtros: { sistema: opts?.sistema ?? null },
      totales,
      padrones: Array.from(porPadron.values()).map((b) => ({
        centro: b.centro,
        padron: b.padronRaw,
        base6: b.base6,
        dv: b.dv,
        sistema: b.sistema,
        afiliados: b.afiliados,
        codigos: b.codigos,
        total: b.totalCodigos,
      })),
    };
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
}
