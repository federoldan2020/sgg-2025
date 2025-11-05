// src/modulos/contabilidad/contabilidad.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, type Asiento } from '@prisma/client';
import { parse } from 'csv-parse/sync';

const prisma = new PrismaClient();

type LineaAsientoInput = { cuenta: string; debe: number; haber: number };

type CsvRow = {
  cuenta: string;
  subcta: string;
  nombre: string;
  tipcta?: string;
  tipo?: string;
  UDAP?: string;
};

export type CuentaNodo = {
  id: bigint;
  codigo: string;
  nombre: string;
  tipo: string;
  imputable: boolean;
  padreId: bigint | null;
  hijos: CuentaNodo[];
};

const mapTipoByCuenta = (cuenta: string) => {
  const d = String(cuenta).trim()[0];
  return d === '1'
    ? 'activo'
    : d === '2'
      ? 'pasivo'
      : d === '3'
        ? 'patrimonio'
        : d === '4'
          ? 'ingreso'
          : d === '5'
            ? 'gasto'
            : 'otros';
};

const norm = (s?: string | null) =>
  (s ?? '').toString().normalize('NFKC').replace(/\s+/g, ' ').trim();

// where único compuesto (@@unique([organizacionId, codigo], name: "org_codigo_cuenta"))
const whereOrgCodigo = (
  organizacionId: string,
  codigo: string,
): Prisma.CuentaContableWhereUniqueInput => ({
  org_codigo_cuenta: { organizacionId, codigo },
});

@Injectable()
export class ContabilidadService {
  // === Plan de Cuentas ===
  async listarPlan(organizacionId: string) {
    return prisma.cuentaContable.findMany({
      where: { organizacionId },
      orderBy: [{ codigo: 'asc' }],
      select: {
        id: true,
        codigo: true,
        nombre: true,
        tipo: true,
        padreId: true,
        imputable: true,
        nivel: true,
      },
    });
  }

  async crearCuenta(
    organizacionId: string,
    data: { codigo: string; nombre: string; tipo: string; padreId?: bigint | null },
  ) {
    return prisma.cuentaContable.create({
      data: {
        organizacionId,
        codigo: data.codigo,
        nombre: data.nombre,
        tipo: data.tipo,
        padreId: data.padreId ?? null,
      },
    });
  }

  // === Mapeos (MVP: los que ya usaba caja) ===
  async listarMapeos(organizacionId: string) {
    return prisma.cuentaMapeo.findMany({
      where: { organizacionId, activo: true },
      orderBy: [{ origen: 'asc' }, { conceptoCodigo: 'asc' }, { metodoPago: 'asc' }],
      select: {
        id: true,
        origen: true,
        conceptoCodigo: true,
        metodoPago: true,
        debeCodigo: true,
        haberCodigo: true,
        descripcion: true,
        activo: true,
      },
    });
  }

  async upsertMapeo(
    organizacionId: string,
    data: {
      origen: string;
      conceptoCodigo?: string | null;
      metodoPago?: string | null;
      debeCodigo: string;
      haberCodigo: string;
      descripcion?: string | null;
    },
  ) {
    const existente = await prisma.cuentaMapeo.findFirst({
      where: {
        organizacionId,
        origen: data.origen,
        conceptoCodigo: data.conceptoCodigo ?? null,
        metodoPago: data.metodoPago ?? null,
      },
      select: { id: true },
    });

    if (existente) {
      return prisma.cuentaMapeo.update({
        where: { id: existente.id },
        data: {
          debeCodigo: data.debeCodigo,
          haberCodigo: data.haberCodigo,
          descripcion: data.descripcion ?? null,
          activo: true,
        },
      });
    }

    return prisma.cuentaMapeo.create({
      data: {
        organizacionId,
        origen: data.origen,
        conceptoCodigo: data.conceptoCodigo ?? null,
        metodoPago: data.metodoPago ?? null,
        debeCodigo: data.debeCodigo,
        haberCodigo: data.haberCodigo,
        descripcion: data.descripcion ?? null,
        activo: true,
      },
    });
  }

  async toggleMapeo(organizacionId: string, id: bigint, activo: boolean) {
    const m = await prisma.cuentaMapeo.findUnique({ where: { id } });
    if (!m || m.organizacionId !== organizacionId) throw new Error('Mapeo inexistente');
    return prisma.cuentaMapeo.update({ where: { id }, data: { activo } });
  }

  // === Asientos (firma compatible con CajaController) ===
  async crearAsiento(
    tx: Prisma.TransactionClient, // 👈 Caja usa TransactionClient
    params: {
      organizacionId: string;
      descripcion: string;
      origen: string;
      referenciaId?: string | null;
      lineas: LineaAsientoInput[];
    },
  ): Promise<Asiento> {
    return tx.asiento.create({
      data: {
        organizacionId: params.organizacionId,
        descripcion: params.descripcion,
        origen: params.origen,
        referenciaId: params.referenciaId ?? null,
        lineas: {
          create: params.lineas.map((l) => ({
            cuenta: l.cuenta,
            debe: l.debe,
            haber: l.haber,
          })),
        },
      },
    });
  }

  // === Mapeo para Pago en Caja (usado por CajaController) ===
  async lineasPagoCaja(
    organizacionId: string,
    params: { metodoPago?: string | null; conceptoCodigo?: string | null; monto: number },
  ) {
    const { metodoPago = null, conceptoCodigo = null, monto } = params;

    const tryFind = async (filtro: {
      conceptoCodigo?: string | null;
      metodoPago?: string | null;
    }) =>
      prisma.cuentaMapeo.findFirst({
        where: {
          organizacionId,
          origen: 'pago_caja',
          activo: true,
          conceptoCodigo: filtro.conceptoCodigo ?? null,
          metodoPago: filtro.metodoPago ?? null,
        },
        select: { debeCodigo: true, haberCodigo: true },
      });

    let m = await tryFind({ conceptoCodigo, metodoPago });
    if (!m && metodoPago) m = await tryFind({ conceptoCodigo: null, metodoPago }); // fallback método
    if (!m) m = await tryFind({ conceptoCodigo: null, metodoPago: null }); // genérico

    if (!m) throw new Error('No hay mapeo contable para pago de caja');

    const lineas: LineaAsientoInput[] = [
      { cuenta: m.debeCodigo, debe: monto, haber: 0 },
      { cuenta: m.haberCodigo, debe: 0, haber: monto },
    ];
    return lineas;
  }

  // === Importar Plan de Cuentas desde CSV/TSV ===
  async importarPlanDesdeCSV(organizacionId: string, buf: Buffer) {
    // 1) detectar separador de la primera línea
    const firstLine =
      buf
        .toString('utf8')
        .split(/\r?\n/)
        .find((l) => l?.trim().length) ?? '';
    const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

    const rows: CsvRow[] = parse(buf, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      delimiter,
      trim: true,
    });

    const entradas = rows.map((r, i) => {
      const cuenta = norm(r.cuenta);
      const subcta = norm(r.subcta).padStart(3, '0');
      const nombre = norm(r.nombre);
      if (!/^\d{3,}$/.test(cuenta)) throw new Error(`Fila ${i + 2}: cuenta inválida`);
      if (!/^\d{3}$/.test(subcta)) throw new Error(`Fila ${i + 2}: subcta inválida`);
      if (!nombre) throw new Error(`Fila ${i + 2}: nombre vacío`);

      const codigo = `${cuenta}.${subcta}`;
      const tipo = mapTipoByCuenta(cuenta);
      const esSimple = (v: string) => /^(simple|s|imputable)$/i.test(v);
      const tipoCta = norm(r.tipcta) || norm(r.tipo);
      const imputable = esSimple(tipoCta);
      const nivel = subcta === '000' ? 1 : 2;
      const padreCodigo = subcta === '000' ? null : `${cuenta}.000`;

      return { cuenta, subcta, codigo, nombre, tipo, imputable, nivel, padreCodigo };
    });

    const porCodigo = new Map<string, bigint>();

    return prisma.$transaction(async (tx) => {
      // padres
      const padres = entradas.filter((e) => e.subcta === '000');
      for (const e of padres) {
        const reg = await tx.cuentaContable.upsert({
          where: whereOrgCodigo(organizacionId, e.codigo),
          update: { nombre: e.nombre, tipo: e.tipo, imputable: false, nivel: e.nivel },
          create: {
            organizacionId,
            codigo: e.codigo,
            nombre: e.nombre,
            tipo: e.tipo,
            imputable: false,
            nivel: e.nivel,
            padreId: null,
          },
          select: { id: true },
        });
        porCodigo.set(e.codigo, reg.id);
      }

      // hijos
      const hijos = entradas.filter((e) => e.subcta !== '000');
      for (const e of hijos) {
        let padreId: bigint | null = null;

        if (e.padreCodigo) {
          let pid = porCodigo.get(e.padreCodigo);
          if (!pid) {
            const regPadre = await tx.cuentaContable.upsert({
              where: whereOrgCodigo(organizacionId, e.padreCodigo),
              update: {},
              create: {
                organizacionId,
                codigo: e.padreCodigo,
                nombre: e.padreCodigo,
                tipo: mapTipoByCuenta(e.cuenta),
                imputable: false,
                nivel: 1,
                padreId: null,
              },
              select: { id: true },
            });
            pid = regPadre.id;
            porCodigo.set(e.padreCodigo, pid);
          }
          padreId = pid;
        }

        const reg = await tx.cuentaContable.upsert({
          where: whereOrgCodigo(organizacionId, e.codigo),
          update: {
            nombre: e.nombre,
            tipo: e.tipo,
            imputable: e.imputable,
            nivel: e.nivel,
            padreId,
          },
          create: {
            organizacionId,
            codigo: e.codigo,
            nombre: e.nombre,
            tipo: e.tipo,
            imputable: e.imputable,
            nivel: e.nivel,
            padreId,
          },
          select: { id: true },
        });
        porCodigo.set(e.codigo, reg.id);
      }

      return { total: entradas.length, padres: padres.length, hijos: hijos.length, ok: true };
    });
  }

  // === Plan en árbol (para el front) ===
  async planComoArbol(organizacionId: string): Promise<CuentaNodo[]> {
    const flat = await prisma.cuentaContable.findMany({
      where: { organizacionId },
      orderBy: [{ codigo: 'asc' }],
      select: { id: true, codigo: true, nombre: true, tipo: true, imputable: true, padreId: true },
    });

    const byId = new Map<string, CuentaNodo>(
      flat.map((x) => [x.id.toString(), { ...x, hijos: [] as CuentaNodo[] }]),
    );

    const roots: CuentaNodo[] = [];
    for (const n of byId.values()) {
      if (n.padreId) {
        const p = byId.get(n.padreId.toString());
        if (p) p.hijos.push(n);
      } else {
        roots.push(n);
      }
    }
    return roots;
  }

  // === Cierre ciego (usado por CajaController.cerrar) ===
  async lineasCierreCaja(
    organizacionId: string,
    params: { montoDeclarado: number; montoTeorico: number; metodoPago?: string | null },
  ) {
    const { montoDeclarado, montoTeorico, metodoPago = null } = params;
    if (montoDeclarado == null || montoTeorico == null) {
      throw new Error('Faltan montos para cierre de caja');
    }

    const diff = Number((montoDeclarado - montoTeorico).toFixed(2));
    if (Math.abs(diff) <= 0.009) return { diff: 0, lineas: [] as LineaAsientoInput[] };

    // mapeo específico por cierre_caja + concepto (sobrante/faltante) + método (opcional)
    const tryFind = async (conceptoCodigo: 'sobrante' | 'faltante') =>
      prisma.cuentaMapeo.findFirst({
        where: {
          organizacionId,
          origen: 'cierre_caja',
          conceptoCodigo,
          metodoPago,
          activo: true,
        },
        select: { debeCodigo: true, haberCodigo: true },
      });

    if (diff > 0) {
      // SOBRANTE: Debe = Caja ; Haber = Sobrante
      const m = await tryFind('sobrante');
      if (!m) throw new Error('No hay mapeo de cierre_caja/sobrante');
      return {
        diff,
        lineas: [
          { cuenta: m.debeCodigo, debe: diff, haber: 0 },
          { cuenta: m.haberCodigo, debe: 0, haber: diff },
        ],
      };
    } else {
      // FALTANTE: Debe = Faltante ; Haber = Caja
      const m = await tryFind('faltante');
      if (!m) throw new Error('No hay mapeo de cierre_caja/faltante');
      const abs = Math.abs(diff);
      return {
        diff,
        lineas: [
          { cuenta: m.debeCodigo, debe: abs, haber: 0 },
          { cuenta: m.haberCodigo, debe: 0, haber: abs },
        ],
      };
    }
  }

  // Lote de cierres → devuelve líneas agregadas para 1 asiento
  async lineasCierreCajaLote(
    organizacionId: string,
    items: Array<{ metodoPago?: string | null; declarado: number; teorico: number }>,
  ) {
    const ajustes: { metodoPago: string | null; diff: number; lineas: LineaAsientoInput[] }[] = [];

    for (const it of items) {
      const { diff, lineas } = await this.lineasCierreCaja(organizacionId, {
        montoDeclarado: it.declarado,
        montoTeorico: it.teorico,
        metodoPago: it.metodoPago ?? null,
      });
      ajustes.push({ metodoPago: it.metodoPago ?? null, diff, lineas });
    }

    const lineas = ajustes.flatMap((a) => a.lineas);
    const diffTotal = Number(ajustes.reduce((acc, a) => acc + a.diff, 0).toFixed(2));
    return { diffTotal, ajustes, lineas };
  }

  // === Helpers de cuentas para mapeos (autocompletado/validación) ===
  async findCuentaPorCodigo(organizacionId: string, codigo: string) {
    return prisma.cuentaContable.findUnique({
      where: { org_codigo_cuenta: { organizacionId, codigo } },
      select: { id: true, codigo: true, nombre: true, imputable: true },
    });
  }

  // firma compatible con el controller de autocompletado:
  // svc.buscarCuentas({ organizacionId, q, imputableOnly?, limit? })
  async buscarCuentas(opts: {
    organizacionId: string;
    q: string;
    imputableOnly?: boolean;
    limit?: number;
  }) {
    const { organizacionId, q, imputableOnly = false, limit = 20 } = opts;

    const where: Prisma.CuentaContableWhereInput = {
      organizacionId,
      OR: [
        { codigo: { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
        { nombre: { contains: q, mode: 'insensitive' as Prisma.QueryMode } },
      ],
      ...(imputableOnly ? { imputable: true } : {}),
    };

    return prisma.cuentaContable.findMany({
      where,
      orderBy: [{ codigo: 'asc' }],
      take: limit,
      select: { id: true, codigo: true, nombre: true, imputable: true },
    });
  }

  // === Full CRUD Mapeos (extras, no rompen caja) ===
  async listarMapeosPaginado(
    organizacionId: string,
    params: {
      q?: string | null;
      origen?: string | null;
      activo?: boolean | null;
      page?: number;
      pageSize?: number;
    },
  ) {
    const { q = null, origen = null, activo = null } = params;
    const page = Math.max(1, Number(params.page ?? 1));
    const pageSize = Math.min(100, Math.max(5, Number(params.pageSize ?? 20)));

    const ci = (s: string) => ({ contains: s, mode: 'insensitive' as Prisma.QueryMode });

    const OR: Prisma.CuentaMapeoWhereInput[] | undefined = q
      ? [
          { origen: ci(q) },
          { descripcion: ci(q) },
          { debeCodigo: ci(q) },
          { haberCodigo: ci(q) },
          { conceptoCodigo: ci(q) },
          { metodoPago: ci(q) },
        ]
      : undefined;

    const where: Prisma.CuentaMapeoWhereInput = {
      organizacionId,
      ...(origen ? { origen } : {}),
      ...(activo === null ? {} : { activo }),
      ...(OR ? { OR } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.cuentaMapeo.findMany({
        where,
        orderBy: [{ origen: 'asc' }, { conceptoCodigo: 'asc' }, { metodoPago: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.cuentaMapeo.count({ where }),
    ]);

    return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }

  async obtenerMapeo(organizacionId: string, id: bigint) {
    const m = await prisma.cuentaMapeo.findUnique({ where: { id } });
    if (!m || m.organizacionId !== organizacionId) throw new Error('Mapeo inexistente');
    return m;
  }

  private async validarCuentas(organizacionId: string, debe: string, haber: string) {
    const [deb, hab] = await Promise.all([
      this.findCuentaPorCodigo(organizacionId, debe),
      this.findCuentaPorCodigo(organizacionId, haber),
    ]);
    if (!deb) throw new Error(`Cuenta Debe inexistente: ${debe}`);
    if (!hab) throw new Error(`Cuenta Haber inexistente: ${haber}`);
    return { deb, hab };
  }

  async crearMapeo(
    organizacionId: string,
    body: {
      origen: string;
      conceptoCodigo?: string | null;
      metodoPago?: string | null;
      debeCodigo: string;
      haberCodigo: string;
      descripcion?: string | null;
    },
  ) {
    const payload = {
      origen: (body.origen ?? '').trim(),
      conceptoCodigo: norm(body.conceptoCodigo),
      metodoPago: norm(body.metodoPago),
      debeCodigo: (body.debeCodigo ?? '').trim(),
      haberCodigo: (body.haberCodigo ?? '').trim(),
      descripcion: norm(body.descripcion),
    };
    if (!payload.origen) throw new Error('origen requerido');
    if (!payload.debeCodigo) throw new Error('debeCodigo requerido');
    if (!payload.haberCodigo) throw new Error('haberCodigo requerido');

    await this.validarCuentas(organizacionId, payload.debeCodigo, payload.haberCodigo);

    return prisma.cuentaMapeo.create({
      data: { organizacionId, ...payload, activo: true },
    });
  }

  async actualizarMapeo(
    organizacionId: string,
    id: bigint,
    body: {
      origen?: string;
      conceptoCodigo?: string | null;
      metodoPago?: string | null;
      debeCodigo?: string;
      haberCodigo?: string;
      descripcion?: string | null;
      activo?: boolean;
    },
  ) {
    const actual = await this.obtenerMapeo(organizacionId, id);

    const payload = {
      origen: body.origen?.trim() ?? actual.origen,
      conceptoCodigo:
        body.conceptoCodigo === undefined ? actual.conceptoCodigo : norm(body.conceptoCodigo),
      metodoPago: body.metodoPago === undefined ? actual.metodoPago : norm(body.metodoPago),
      debeCodigo: (body.debeCodigo ?? actual.debeCodigo).trim(),
      haberCodigo: (body.haberCodigo ?? actual.haberCodigo).trim(),
      descripcion: body.descripcion === undefined ? actual.descripcion : norm(body.descripcion),
      activo: body.activo ?? actual.activo,
    };

    await this.validarCuentas(organizacionId, payload.debeCodigo, payload.haberCodigo);

    return prisma.cuentaMapeo.update({ where: { id }, data: payload });
  }

  async eliminarMapeo(organizacionId: string, id: bigint) {
    await this.obtenerMapeo(organizacionId, id);
    await prisma.cuentaMapeo.delete({ where: { id } });
    return { ok: true };
  }

  // ASIENTOS CONTABLES LISTADOS EN FRONT
  // === Asientos: detalle ===
  async obtenerAsientoDetalle(organizacionId: string, id: bigint) {
    const a = await prisma.asiento.findUnique({
      where: { id },
      select: {
        id: true,
        organizacionId: true,
        fecha: true,
        descripcion: true,
        origen: true,
        referenciaId: true,
        lineas: {
          orderBy: [{ id: 'asc' }],
          select: { id: true, cuenta: true, debe: true, haber: true },
        },
      },
    });
    if (!a || a.organizacionId !== organizacionId) throw new Error('Asiento inexistente');

    const totalDebe = a.lineas.reduce((acc, l) => acc + Number(l.debe || 0), 0);
    const totalHaber = a.lineas.reduce((acc, l) => acc + Number(l.haber || 0), 0);

    return {
      id: a.id.toString(),
      fecha: a.fecha,
      descripcion: a.descripcion,
      origen: a.origen,
      referenciaId: a.referenciaId,
      lineas: a.lineas.map((l) => ({
        id: l.id.toString(),
        cuenta: l.cuenta,
        debe: Number(l.debe),
        haber: Number(l.haber),
      })),
      totalDebe: Number(totalDebe.toFixed(2)),
      totalHaber: Number(totalHaber.toFixed(2)),
    };
  }

  // === Asientos: listado con filtros ===
  async listarAsientos(
    organizacionId: string,
    params: {
      desde?: string | null; // 'YYYY-MM-DD'
      hasta?: string | null; // 'YYYY-MM-DD'
      origen?: string | null;
      q?: string | null; // busca en descripcion y referenciaId
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, Number(params.page ?? 1));
    const pageSize = Math.min(100, Math.max(5, Number(params.pageSize ?? 20)));

    const fechaFrom = params.desde ? new Date(params.desde + 'T00:00:00') : null;
    const fechaTo = params.hasta ? new Date(params.hasta + 'T23:59:59') : null;

    const where: Prisma.AsientoWhereInput = {
      organizacionId,
      ...(params.origen ? { origen: params.origen } : {}),
      ...(fechaFrom || fechaTo
        ? { fecha: { gte: fechaFrom ?? undefined, lte: fechaTo ?? undefined } }
        : {}),
      ...(params.q
        ? {
            OR: [
              { descripcion: { contains: params.q, mode: 'insensitive' } },
              { referenciaId: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.asiento.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          fecha: true,
          descripcion: true,
          origen: true,
          referenciaId: true,
          lineas: { select: { debe: true, haber: true } },
        },
      }),
      prisma.asiento.count({ where }),
    ]);

    const rows = items.map((a) => {
      const debe = a.lineas.reduce((acc, l) => acc + Number(l.debe || 0), 0);
      const haber = a.lineas.reduce((acc, l) => acc + Number(l.haber || 0), 0);
      return {
        id: a.id.toString(),
        fecha: a.fecha,
        descripcion: a.descripcion,
        origen: a.origen,
        referenciaId: a.referenciaId,
        totalDebe: Number(debe.toFixed(2)),
        totalHaber: Number(haber.toFixed(2)),
      };
    });

    return { items: rows, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }

  // === Util: armar CSV desde el resultado del listado ===
  buildAsientosCSV(listado: Awaited<ReturnType<ContabilidadService['listarAsientos']>>) {
    const header = [
      'id',
      'fecha',
      'origen',
      'referenciaId',
      'descripcion',
      'totalDebe',
      'totalHaber',
    ].join(',');
    const lines = listado.items.map((r) =>
      [
        r.id,
        new Date(r.fecha).toISOString().slice(0, 10),
        r.origen ?? '',
        r.referenciaId ?? '',
        (r.descripcion ?? '').replaceAll('"', '""'),
        r.totalDebe.toFixed(2),
        r.totalHaber.toFixed(2),
      ]
        .map((v) => (/[",\n]/.test(String(v)) ? `"${String(v)}"` : String(v)))
        .join(','),
    );
    return [header, ...lines].join('\n');
  }

  async obtenerAsiento(organizacionId: string, id: bigint) {
    const a = await prisma.asiento.findUnique({
      where: { id },
      include: { lineas: { select: { id: true, cuenta: true, debe: true, haber: true } } },
    });
    if (!a || a.organizacionId !== organizacionId) throw new Error('Asiento inexistente');

    const lineas = a.lineas.map((l) => ({
      ...l,
      debe: Number(l.debe),
      haber: Number(l.haber),
    }));

    return { ...a, lineas };
  }

  // ===================== Seeds útiles =====================
  async seedMapeosCierreCaja(organizacionId: string) {
    // Ajustá los códigos a tu plan real
    const SOBRANTE = {
      origen: 'cierre_caja',
      conceptoCodigo: 'sobrante',
      metodoPago: 'efectivo',
      debeCodigo: '10101.001', // Caja
      haberCodigo: '40919.000', // Sobrante de Caja (ingreso)
      descripcion: 'Cierre ciego - sobrante efectivo',
    };

    const FALTANTE = {
      origen: 'cierre_caja',
      conceptoCodigo: 'faltante',
      metodoPago: 'efectivo',
      debeCodigo: '52206.000', // Faltante de Caja (gasto)
      haberCodigo: '10101.001', // Caja
      descripcion: 'Cierre ciego - faltante efectivo',
    };

    await this.upsertMapeo(organizacionId, SOBRANTE);
    await this.upsertMapeo(organizacionId, FALTANTE);

    return { ok: true, creados: ['sobrante/efectivo', 'faltante/efectivo'] };
  }

  // ===================== Hooks Terceros → Asientos =====================

  // Busca mapeo por origen + concepto con fallback por rol (concepto_ROL → concepto → null)
  private async findMapeoConFallback(
    organizacionId: string,
    origen: string,
    concepto: string,
    rol?: string | null,
  ) {
    const tryFind = async (conceptoCodigo: string | null) =>
      prisma.cuentaMapeo.findFirst({
        where: { organizacionId, origen, activo: true, conceptoCodigo },
        select: { debeCodigo: true, haberCodigo: true },
      });

    if (rol) {
      const m = await tryFind(`${concepto}_${rol}`);
      if (m) return m;
    }
    const m2 = await tryFind(concepto);
    if (m2) return m2;
    const m3 = await tryFind(null);
    if (m3) return m3;

    throw new Error(
      `No hay mapeo contable para origen=${origen} concepto=${concepto}${rol ? ` rol=${rol}` : ''}`,
    );
  }

  // Construye dos líneas desde un mapeo para un monto (Debe/Haber iguales)
  private buildLineasDesdeMapeo(
    m: { debeCodigo: string; haberCodigo: string },
    monto: number,
    side: 'debe' | 'haber',
  ): LineaAsientoInput[] {
    const amt = Number((monto ?? 0).toFixed(2));
    if (!amt) return [];
    const cuenta = side === 'debe' ? m.debeCodigo : m.haberCodigo;
    return [{ cuenta, debe: side === 'debe' ? amt : 0, haber: side === 'haber' ? amt : 0 }];
  }

  /**
   * Asiento por comprobante de tercero (EMISIÓN).
   * Origen: "comprobante_tercero" — referenciaId = comprobante.id (string)
   */
  async onComprobanteEmitido(
    tx: Prisma.TransactionClient,
    params: { organizacionId: string; comprobanteId: bigint },
  ) {
    const { organizacionId, comprobanteId } = params;

    // Idempotencia
    const ya = await tx.asiento.findFirst({
      where: {
        organizacionId,
        origen: 'comprobante_tercero',
        referenciaId: comprobanteId.toString(),
      },
      select: { id: true },
    });
    if (ya) return ya;

    const comp = await tx.comprobanteTercero.findUnique({
      where: { id: comprobanteId },
      include: { lineas: true, impuestos: true, cuenta: { select: { rol: true } } },
    });
    if (!comp || comp.organizacionId !== organizacionId) throw new Error('Comprobante inexistente');

    const rol = comp.cuenta.rol;

    const to2 = (n?: Prisma.Decimal | null) => Number(Number(n ?? 0).toFixed(2));
    const neto =
      to2(comp.netoGravado21) +
      to2(comp.netoGravado105) +
      to2(comp.netoGravado27) +
      to2(comp.netoNoGravado) +
      to2(comp.netoExento);

    const iva = to2(comp.iva21) + to2(comp.iva105) + to2(comp.iva27);
    const exento = to2(comp.netoExento);
    const noGrav = to2(comp.netoNoGravado);

    const percepIva = to2(comp.percepIVA);
    const retIva = to2(comp.retIVA);
    const retGan = to2(comp.retGanancias);
    const percepIibb = to2(comp.percepIIBB);
    const retIibb = to2(comp.retIIBB);

    const impMunicipal = to2(comp.impMunicipal);
    const impInterno = to2(comp.impInterno);
    const gastoAdmin = to2(comp.gastoAdmin);
    const otros = to2(comp.otrosImpuestos);

    const total = to2(comp.total);

    const lineas: LineaAsientoInput[] = [];

    const componentes: Array<{ concepto: string; monto: number }> = [
      { concepto: 'neto', monto: neto },
      { concepto: 'iva', monto: iva },
      { concepto: 'exento', monto: exento },
      { concepto: 'no_gravado', monto: noGrav },
      { concepto: 'percep_iva', monto: percepIva },
      { concepto: 'ret_iva', monto: retIva },
      { concepto: 'ret_gan', monto: retGan },
      { concepto: 'percep_iibb', monto: percepIibb },
      { concepto: 'ret_iibb', monto: retIibb },
      { concepto: 'imp_municipal', monto: impMunicipal },
      { concepto: 'imp_interno', monto: impInterno },
      { concepto: 'gasto_admin', monto: gastoAdmin },
      { concepto: 'otros', monto: otros },
    ];

    for (const c of componentes) {
      if (!c.monto) continue;
      const m = await this.findMapeoConFallback(
        organizacionId,
        'comprobante_tercero',
        c.concepto,
        rol,
      );
      lineas.push(...this.buildLineasDesdeMapeo(m, c.monto, 'debe'));
    }

    // 2) Contrapartida CxP total -> al HABER (usa m.haberCodigo)
    const mCxp = await this.findMapeoConFallback(organizacionId, 'comprobante_tercero', 'cxp', rol);
    lineas.push(...this.buildLineasDesdeMapeo(mCxp, total, 'haber'));

    return this.crearAsiento(tx, {
      organizacionId,
      descripcion: `Comprobante ${rol} #${comp.id}`,
      origen: 'comprobante_tercero',
      referenciaId: comp.id.toString(),
      lineas,
    });
  }

  /** Reversa cuando se ANULA el comprobante */
  async onComprobanteAnulado(
    tx: Prisma.TransactionClient,
    params: { organizacionId: string; comprobanteId: bigint },
  ) {
    const { organizacionId, comprobanteId } = params;

    const a = await tx.asiento.findFirst({
      where: {
        organizacionId,
        origen: 'comprobante_tercero',
        referenciaId: comprobanteId.toString(),
      },
      include: { lineas: true },
    });
    if (!a) return null; // nada que revertir

    const lineas = a.lineas.map((l) => ({
      cuenta: l.cuenta,
      debe: Number(l.haber),
      haber: Number(l.debe),
    }));

    return this.crearAsiento(tx, {
      organizacionId,
      descripcion: `Reversa comprobante #${comprobanteId.toString()}`,
      origen: 'comprobante_tercero_reversa',
      referenciaId: comprobanteId.toString(),
      lineas,
    });
  }

  /**
   * Asiento por ORDEN DE PAGO confirmada.
   * Origen: "orden_pago_tercero" — referenciaId = orden.id (string)
   */
  async onOrdenPagoConfirmada(
    tx: Prisma.TransactionClient,
    params: { organizacionId: string; ordenId: bigint },
  ) {
    const { organizacionId, ordenId } = params;

    const ya = await tx.asiento.findFirst({
      where: { organizacionId, origen: 'orden_pago_tercero', referenciaId: ordenId.toString() },
      select: { id: true },
    });
    if (ya) return ya;

    const orden = await tx.ordenPagoTercero.findUnique({
      where: { id: ordenId },
      include: {
        cuenta: { select: { rol: true } },
        metodos: true,
        aplicaciones: { include: { comprobante: { select: { id: true, total: true } } } },
      },
    });
    if (!orden || orden.organizacionId !== organizacionId) throw new Error('Orden inexistente');

    const rol = orden.cuenta.rol;

    const aplicado = Number(
      orden.aplicaciones.reduce((acc, a) => acc + Number(a.montoAplicado || 0), 0).toFixed(2),
    );

    const lineas: LineaAsientoInput[] = [];

    // Debe CxP por aplicado
    if (aplicado) {
      const mCxp = await this.findMapeoConFallback(
        organizacionId,
        'orden_pago_tercero',
        'cxp',
        rol,
      );
      lineas.push(...this.buildLineasDesdeMapeo(mCxp, aplicado, 'debe'));
    }

    // Haber: por cada método de pago
    // Haber por cada método
    for (const m of orden.metodos) {
      const conceptoMetodo =
        m.metodo === 'transferencia'
          ? 'mp_transferencia'
          : m.metodo === 'cheque'
            ? 'mp_cheque'
            : m.metodo === 'efectivo'
              ? 'mp_efectivo'
              : 'mp_otro';

      const map = await this.findMapeoConFallback(
        organizacionId,
        'orden_pago_tercero',
        conceptoMetodo,
        rol,
      );
      lineas.push(...this.buildLineasDesdeMapeo(map, Number(m.monto), 'haber'));
    }

    return this.crearAsiento(tx, {
      organizacionId,
      descripcion: `Orden de Pago ${rol} #${orden.id}`,
      origen: 'orden_pago_tercero',
      referenciaId: orden.id.toString(),
      lineas,
    });
  }

  /** Reversa cuando se ANULA la OP */
  async onOrdenPagoAnulada(
    tx: Prisma.TransactionClient,
    params: { organizacionId: string; ordenId: bigint },
  ) {
    const { organizacionId, ordenId } = params;

    const a = await tx.asiento.findFirst({
      where: { organizacionId, origen: 'orden_pago_tercero', referenciaId: ordenId.toString() },
      include: { lineas: true },
    });
    if (!a) return null;

    const lineas = a.lineas.map((l) => ({
      cuenta: l.cuenta,
      debe: Number(l.haber),
      haber: Number(l.debe),
    }));

    return this.crearAsiento(tx, {
      organizacionId,
      descripcion: `Reversa OP #${ordenId.toString()}`,
      origen: 'orden_pago_tercero_reversa',
      referenciaId: ordenId.toString(),
      lineas,
    });
  }

  // === SEED TERCEROS (comprobantes/OP) ===============================
  async seedMapeosTerceros(
    organizacionId: string,
    body?: {
      rol?: 'PROVEEDOR' | 'PRESTADOR' | 'AFILIADO' | 'OTRO' | null;
      cuentas?: {
        // misma cuenta puente para “enganchar” comprobantes ↔ OP
        puente?: string; // p.ej. "19999.000" (Puente Terceros)
        cxp?: string; // p.ej. "21101.000" (Cuentas a pagar)
        gasto?: string; // p.ej. "51101.000" (Gastos / compras)
        ivaCredito?: string; // p.ej. "11109.000" (IVA crédito fiscal)
        exento?: string; // si lo querés separar; sino reuse gasto
        noGravado?: string; // idem
        otros?: string; // otros impuestos varios
        gastoAdmin?: string;
        impInterno?: string;
        impMunicipal?: string;
        percepIVA?: string;
        retIVA?: string;
        retGan?: string;
        percepIIBB?: string;
        retIIBB?: string;

        // métodos de pago (haber en OP)
        mp_efectivo?: string; // p.ej. "10101.001"
        mp_transferencia?: string; // p.ej. "11201.000"
        mp_cheque?: string; // p.ej. "11301.000"
        mp_otro?: string; // p.ej. "11999.000"
      };
    },
  ) {
    const rol = body?.rol ?? null;

    // ⚠️ Ajustá estos defaults a tu plan: son ejemplos razonables
    const cuentas = {
      puente: body?.cuentas?.puente ?? '19999.000',
      cxp: body?.cuentas?.cxp ?? '21101.000',
      gasto: body?.cuentas?.gasto ?? '51101.000',
      ivaCredito: body?.cuentas?.ivaCredito ?? '11109.000',
      exento: body?.cuentas?.exento ?? '51101.000',
      noGravado: body?.cuentas?.noGravado ?? '51101.000',
      otros: body?.cuentas?.otros ?? '51900.000',
      gastoAdmin: body?.cuentas?.gastoAdmin ?? '51910.000',
      impInterno: body?.cuentas?.impInterno ?? '51920.000',
      impMunicipal: body?.cuentas?.impMunicipal ?? '51930.000',
      percepIVA: body?.cuentas?.percepIVA ?? '11110.000',
      retIVA: body?.cuentas?.retIVA ?? '21110.000',
      retGan: body?.cuentas?.retGan ?? '21111.000',
      percepIIBB: body?.cuentas?.percepIIBB ?? '11111.000',
      retIIBB: body?.cuentas?.retIIBB ?? '21112.000',
      mp_efectivo: body?.cuentas?.mp_efectivo ?? '10101.001',
      mp_transferencia: body?.cuentas?.mp_transferencia ?? '11201.000',
      mp_cheque: body?.cuentas?.mp_cheque ?? '11301.000',
      mp_otro: body?.cuentas?.mp_otro ?? '11999.000',
    };

    // helper para concepto con sufijo de rol (coincide con tu fallback en hooks)
    const C = (base: string) => (rol ? `${base}_${rol}` : base);

    // ============ comprobante_tercero ============
    // Regla: cada componente (neto/iva/etc.) → Debe a su cuenta / Haber a “puente”
    // y además “cxp” → Debe “puente” / Haber CxP (por el total)
    const ct = 'comprobante_tercero';
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('neto'),
      debeCodigo: cuentas.gasto,
      haberCodigo: cuentas.puente,
      descripcion: 'Neto de compra',
    });
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('iva'),
      debeCodigo: cuentas.ivaCredito,
      haberCodigo: cuentas.puente,
      descripcion: 'IVA crédito fiscal',
    });
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('exento'),
      debeCodigo: cuentas.exento,
      haberCodigo: cuentas.puente,
      descripcion: 'Importe exento',
    });
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('no_gravado'),
      debeCodigo: cuentas.noGravado,
      haberCodigo: cuentas.puente,
      descripcion: 'Importe no gravado',
    });

    // Percepciones/retenciones/impuestos varios (ajustá según uso)
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('percep_iva'),
      debeCodigo: cuentas.percepIVA,
      haberCodigo: cuentas.puente,
      descripcion: 'Percepción IVA (a favor)',
    });
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('ret_iva'),
      debeCodigo: cuentas.puente,
      haberCodigo: cuentas.retIVA,
      descripcion: 'Retención IVA (a pagar)',
    });
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('ret_gan'),
      debeCodigo: cuentas.puente,
      haberCodigo: cuentas.retGan,
      descripcion: 'Retención Ganancias (a pagar)',
    });
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('percep_iibb'),
      debeCodigo: cuentas.percepIIBB,
      haberCodigo: cuentas.puente,
      descripcion: 'Percepción IIBB (a favor)',
    });
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('ret_iibb'),
      debeCodigo: cuentas.puente,
      haberCodigo: cuentas.retIIBB,
      descripcion: 'Retención IIBB (a pagar)',
    });

    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('imp_interno'),
      debeCodigo: cuentas.impInterno,
      haberCodigo: cuentas.puente,
      descripcion: 'Impuesto interno',
    });
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('imp_municipal'),
      debeCodigo: cuentas.impMunicipal,
      haberCodigo: cuentas.puente,
      descripcion: 'Impuesto municipal/tasas',
    });
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('gasto_admin'),
      debeCodigo: cuentas.gastoAdmin,
      haberCodigo: cuentas.puente,
      descripcion: 'Gastos administrativos',
    });
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('otros'),
      debeCodigo: cuentas.otros,
      haberCodigo: cuentas.puente,
      descripcion: 'Otros impuestos/conceptos',
    });

    // contrapartida CxP por TOTAL
    await this.upsertMapeo(organizacionId, {
      origen: ct,
      conceptoCodigo: C('cxp'),
      debeCodigo: cuentas.puente,
      haberCodigo: cuentas.cxp,
      descripcion: 'Cuentas a pagar (total)',
    });

    // ============ orden_pago_tercero ============
    // Regla: Debe CxP por aplicado ; Haber métodos de pago
    // Se usa la misma “puente” para cuadrar líneas (Debe puente / Haber caja/banco)
    const op = 'orden_pago_tercero';
    await this.upsertMapeo(organizacionId, {
      origen: op,
      conceptoCodigo: C('cxp'),
      debeCodigo: cuentas.cxp,
      haberCodigo: cuentas.puente,
      descripcion: 'Baja de CxP por aplicado',
    });
    await this.upsertMapeo(organizacionId, {
      origen: op,
      conceptoCodigo: C('mp_efectivo'),
      debeCodigo: cuentas.puente,
      haberCodigo: cuentas.mp_efectivo,
      descripcion: 'Pago en efectivo',
    });
    await this.upsertMapeo(organizacionId, {
      origen: op,
      conceptoCodigo: C('mp_transferencia'),
      debeCodigo: cuentas.puente,
      haberCodigo: cuentas.mp_transferencia,
      descripcion: 'Pago por transferencia',
    });
    await this.upsertMapeo(organizacionId, {
      origen: op,
      conceptoCodigo: C('mp_cheque'),
      debeCodigo: cuentas.puente,
      haberCodigo: cuentas.mp_cheque,
      descripcion: 'Pago con cheque',
    });
    await this.upsertMapeo(organizacionId, {
      origen: op,
      conceptoCodigo: C('mp_otro'),
      debeCodigo: cuentas.puente,
      haberCodigo: cuentas.mp_otro,
      descripcion: 'Otro medio de pago',
    });

    return { ok: true, rol: rol ?? '(genérico)', cuentas };
  }
}
