/* eslint-disable @typescript-eslint/no-unsafe-argument */
// src/modulos/terceros/terceros.service.ts
import { Injectable } from '@nestjs/common';
import { RolTercero, TipoPersona, CondIva, Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import prisma from '../../prisma';

import type { Prisma as P } from '@prisma/client';

/* =================== helpers =================== */
const norm = (s?: string | null) =>
  (s ?? '').toString().normalize('NFKC').replace(/\s+/g, ' ').trim();

const nn = (s?: string | null) => {
  const v = norm(s);
  return v ? v : null;
};

const onlyDigits = (s: string) => s.replace(/\D+/g, '');
const cleanCuit = (s?: string | null) => {
  const d = onlyDigits(norm(s));
  return d.length >= 11 ? d.slice(0, 11) : d || null;
};

const mapCondIva = (s?: string | null): CondIva | null => {
  const v = norm(s).toLowerCase();
  if (!v) return null;
  if (/inscrip/.test(v)) return 'INSCRIPTO';
  if (/mono/.test(v)) return 'MONOTRIBUTO';
  if (/exent/.test(v)) return 'EXENTO';
  if (/consumidor/.test(v) || /final/.test(v) || v === 'cf') return 'CONSUMIDOR_FINAL';
  if (/no\s*responsable/.test(v)) return 'NO_RESPONSABLE';
  return null;
};

const mapTipoPersona = (s?: string | null): TipoPersona | null => {
  const v = norm(s).toLowerCase();
  if (!v) return null;
  if (/fisic/.test(v)) return 'FISICA';
  if (/jurid/.test(v)) return 'JURIDICA';
  return 'OTRO';
};

const boolSiNo = (s?: string | null) => /^(si|sí|s|true|1)$/i.test(norm(s));

// dinero: admite "1.234,56", "1,234.56", "1234,56", "1234.56"
const parseMoney = (s?: string | null): number | null => {
  const raw = norm(s);
  if (!raw) return null;
  let t = raw;
  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  if (hasComma && hasDot) t = t.replace(/\./g, '').replace(',', '.');
  else if (hasComma) t = t.replace(',', '.');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

type RolFlag = Partial<Record<RolTercero, boolean>>;
const rolesFromRow = (r: Record<string, string | null | undefined>): RolFlag => {
  const rol = norm((r.rol ?? (r as any).ROL) as string | undefined).toLowerCase();
  const flags: RolFlag = {};
  if (rol.includes('provee')) flags.PROVEEDOR = true;
  if (rol.includes('presta')) flags.PRESTADOR = true;
  if (rol.includes('afili')) flags.AFILIADO = true;

  // columnas booleanas opcionales: proveedor, prestador, afiliado
  if (r.proveedor != null) flags.PROVEEDOR = boolSiNo(String(r.proveedor));
  if (r.prestador != null) flags.PRESTADOR = boolSiNo(String(r.prestador));
  if (r.afiliado != null) flags.AFILIADO = boolSiNo(String(r.afiliado));

  // fallback
  if (!flags.PROVEEDOR && !flags.PRESTADOR && !flags.AFILIADO) flags.OTRO = true;
  return flags;
};

/* =================== Tipos DTO =================== */
export type TerceroUpsert = {
  codigo?: string | null;
  tipoPersona?: TipoPersona | null;
  nombre: string;
  fantasia?: string | null;
  cuit?: string | null;
  iibb?: string | null;
  condIva?: CondIva | null;
  activo?: boolean;
  notas?: string | null;

  saldoInicial?: Prisma.Decimal | number | null | undefined;
  saldoActual?: Prisma.Decimal | number | null | undefined;

  impositivo?: {
    exentoIva?: boolean;
    percepIva?: Prisma.Decimal | number | null;
    retGanancias?: Prisma.Decimal | number | null;
    percepIibb?: Prisma.Decimal | number | null;
  } | null;

  direcciones?: Array<{
    etiqueta?: string | null;
    calle?: string | null;
    numero?: string | null;
    piso?: string | null;
    dpto?: string | null;
    ciudad?: string | null;
    provincia?: string | null;
    cp?: string | null;
    pais?: string | null;
    principal?: boolean;
  }>;

  contactos?: Array<{
    tipo: 'EMAIL' | 'TELEFONO' | 'WHATSAPP' | 'WEB' | 'OTRO';
    valor: string;
    etiqueta?: string | null;
    principal?: boolean;
  }>;

  bancos?: Array<{
    banco?: string | null;
    tipo: 'CBU' | 'ALIAS' | 'CVU' | 'CCI' | 'OTRO';
    numero: string;
    titular?: string | null;
    cuitTitular?: string | null;
  }>;

  roles?: RolTercero[];
};

type CsvRow = Record<string, string | null | undefined>;
type TerceroFull = P.TerceroGetPayload<{
  include: { roles: true; direcciones: true; contactos: true; bancos: true; impositivo: true };
}>;

/* =================== Service =================== */
@Injectable()
export class TercerosService {
  /* ===== Listar paginado con filtros ===== */
  async listar(
    organizacionId: string,
    opts: {
      q?: string | null;
      rol?: RolTercero | null;
      activo?: boolean | null;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, Number(opts.page ?? 1));
    const pageSize = Math.min(100, Math.max(5, Number(opts.pageSize ?? 20)));

    const where: P.TerceroWhereInput = {
      organizacionId,
      ...(opts.activo == null ? {} : { activo: opts.activo }),
      ...(opts.q
        ? {
            OR: [
              { nombre: { contains: opts.q, mode: 'insensitive' } },
              { fantasia: { contains: opts.q, mode: 'insensitive' } },
              { cuit: { contains: opts.q } },
              { codigo: { contains: opts.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(opts.rol ? { roles: { some: { rol: opts.rol } } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.tercero.findMany({
        where,
        orderBy: [{ nombre: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          nombre: true,
          fantasia: true,
          cuit: true,
          codigo: true,
          condIva: true,
          tipoPersona: true,
          activo: true,
          roles: true,
        },
      }),
      prisma.tercero.count({ where }),
    ]);

    return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }

  async obtener(organizacionId: string, id: bigint): Promise<TerceroFull> {
    const t = await prisma.tercero.findUnique({
      where: { id },
      include: { roles: true, direcciones: true, contactos: true, bancos: true, impositivo: true },
    });
    if (!t || t.organizacionId !== organizacionId) throw new Error('Tercero inexistente');
    return t;
  }

  /* ===== Helpers internos sobre TX ===== */
  private async syncRoles(
    tx: Prisma.TransactionClient,
    terceroId: bigint,
    roles: RolTercero[] | undefined,
  ) {
    if (!roles) return;
    const uniq = Array.from(new Set(roles));
    const actuales = await tx.terceroRol.findMany({ where: { terceroId } });
    const actualesSet = new Set(actuales.map((r) => r.rol));
    const toDel = actuales.filter((r) => !uniq.includes(r.rol)).map((r) => r.id);
    const toAdd = uniq.filter((r) => !actualesSet.has(r));

    if (toDel.length) await tx.terceroRol.deleteMany({ where: { id: { in: toDel } } });
    if (toAdd.length) {
      await tx.terceroRol.createMany({
        data: toAdd.map((rol) => ({ terceroId, rol })),
        skipDuplicates: true,
      });
    }
  }

  private async replaceChildren(
    tx: Prisma.TransactionClient,
    terceroId: bigint,
    model: 'terceroDireccion' | 'terceroContacto' | 'terceroBanco',
    data: Array<Record<string, unknown>>,
  ): Promise<void> {
    const table = (
      tx as unknown as Record<
        typeof model,
        {
          deleteMany: (args: { where: { terceroId: bigint } }) => Promise<unknown>;
          createMany: (args: { data: Array<Record<string, unknown>> }) => Promise<unknown>;
        }
      >
    )[model];

    await table.deleteMany({ where: { terceroId } });
    if (data.length) {
      const rows: Array<Record<string, unknown>> = data.map((d) => ({ ...d, terceroId }));
      await table.createMany({ data: rows });
    }
  }

  // === Cuentas por rol ===
  private async ensureCuentaByRol(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    terceroId: bigint,
    rol: RolTercero,
  ): Promise<bigint> {
    const txAny = tx as unknown as {
      cuentaTercero: {
        findFirst: (args: any) => Promise<{ id: bigint } | null>;
        create: (args: any) => Promise<{ id: bigint }>;
      };
    };

    let cta = await txAny.cuentaTercero.findFirst({
      where: { organizacionId, terceroId, rol },
      select: { id: true },
    });

    if (!cta) {
      cta = await txAny.cuentaTercero.create({
        data: { organizacionId, terceroId, rol, activo: true },
        select: { id: true },
      });
    }

    return BigInt(cta.id.toString());
  }

  private async upsertSaldosCuenta(
    tx: Prisma.TransactionClient,
    cuentaId: bigint,
    opts: {
      saldoInicial?: Prisma.Decimal | number | null | undefined;
      saldoActual?: Prisma.Decimal | number | null | undefined;
    },
  ): Promise<void> {
    const data: Record<string, Prisma.Decimal | number | null> = {};
    if (opts.saldoInicial !== undefined) data.saldoInicial = opts.saldoInicial ?? null;
    if (opts.saldoActual !== undefined) data.saldoActual = opts.saldoActual ?? null;

    if (Object.keys(data).length) {
      const txAny = tx as unknown as { cuentaTercero: { update: (args: any) => Promise<unknown> } };
      await txAny.cuentaTercero.update({ where: { id: cuentaId }, data });
    }
  }

  private async crearConTx(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    payload: ReturnType<TercerosService['normalizeUpsert']>,
  ): Promise<bigint> {
    const t = await tx.tercero.create({
      data: {
        organizacionId,
        codigo: payload.codigo ?? null,
        tipoPersona: payload.tipoPersona ?? null,
        nombre: payload.nombre,
        fantasia: payload.fantasia ?? null,
        cuit: payload.cuit ?? null,
        iibb: payload.iibb ?? null,
        condIva: payload.condIva ?? null,
        activo: payload.activo ?? true,
        notas: payload.notas ?? null,
      },
      select: { id: true },
    });

    if (payload.impositivo) {
      await tx.terceroImpositivo.create({
        data: {
          terceroId: t.id,
          exentoIva: Boolean(payload.impositivo.exentoIva),
          percepIva: payload.impositivo.percepIva ?? null,
          retGanancias: payload.impositivo.retGanancias ?? null,
          percepIibb: payload.impositivo.percepIibb ?? null,
        },
      });
    }

    await this.replaceChildren(tx, t.id, 'terceroDireccion', payload.direcciones ?? []);
    await this.replaceChildren(tx, t.id, 'terceroContacto', payload.contactos ?? []);
    await this.replaceChildren(tx, t.id, 'terceroBanco', payload.bancos ?? []);
    await this.syncRoles(tx, t.id, payload.roles);

    return t.id;
  }

  private async actualizarConTx(
    tx: Prisma.TransactionClient,
    id: bigint,
    payload: ReturnType<TercerosService['normalizeUpsert']>,
  ): Promise<void> {
    await tx.tercero.update({
      where: { id },
      data: {
        codigo: payload.codigo ?? null,
        tipoPersona: payload.tipoPersona ?? null,
        nombre: payload.nombre,
        fantasia: payload.fantasia ?? null,
        cuit: payload.cuit ?? null,
        iibb: payload.iibb ?? null,
        condIva: payload.condIva ?? null,
        activo: payload.activo ?? true,
        notas: payload.notas ?? null,
      },
    });

    if (payload.impositivo) {
      await tx.terceroImpositivo.upsert({
        where: { terceroId: id },
        create: {
          terceroId: id,
          exentoIva: Boolean(payload.impositivo.exentoIva),
          percepIva: payload.impositivo.percepIva ?? null,
          retGanancias: payload.impositivo.retGanancias ?? null,
          percepIibb: payload.impositivo.percepIibb ?? null,
        },
        update: {
          exentoIva: Boolean(payload.impositivo.exentoIva),
          percepIva: payload.impositivo.percepIva ?? null,
          retGanancias: payload.impositivo.retGanancias ?? null,
          percepIibb: payload.impositivo.percepIibb ?? null,
        },
      });
    }

    await this.replaceChildren(tx, id, 'terceroDireccion', payload.direcciones ?? []);
    await this.replaceChildren(tx, id, 'terceroContacto', payload.contactos ?? []);
    await this.replaceChildren(tx, id, 'terceroBanco', payload.bancos ?? []);
    await this.syncRoles(tx, id, payload.roles);
  }

  /* ===== CRUD público ===== */
  async crear(organizacionId: string, body: TerceroUpsert): Promise<TerceroFull> {
    const payload = this.normalizeUpsert(body);
    if (!payload.nombre) throw new Error('Nombre requerido');

    const id = await prisma.$transaction(async (tx) =>
      this.crearConTx(tx, organizacionId, payload),
    );
    return this.obtener(organizacionId, id);
  }

  async actualizar(organizacionId: string, id: bigint, body: TerceroUpsert): Promise<TerceroFull> {
    await this.obtener(organizacionId, id);
    const actual = await prisma.tercero.findUnique({ where: { id } });
    const payload = this.normalizeUpsert(body, actual);
    await prisma.$transaction(async (tx) => this.actualizarConTx(tx, id, payload));
    return this.obtener(organizacionId, id);
  }

  async toggleActivo(organizacionId: string, id: bigint, activo: boolean) {
    await this.obtener(organizacionId, id);
    await prisma.tercero.update({ where: { id }, data: { activo } });
    return { ok: true };
  }

  async eliminar(organizacionId: string, id: bigint) {
    await this.obtener(organizacionId, id);
    await prisma.tercero.delete({ where: { id } });
    return { ok: true };
  }

  /* ===== Autocomplete / buscar ===== */
  async buscar(organizacionId: string, q: string, rol?: RolTercero | null, limit = 20) {
    const where: P.TerceroWhereInput = {
      organizacionId,
      OR: [
        { nombre: { contains: q, mode: 'insensitive' } },
        { fantasia: { contains: q, mode: 'insensitive' } },
        { cuit: { contains: q } },
        { codigo: { contains: q, mode: 'insensitive' } },
      ],
      ...(rol ? { roles: { some: { rol } } } : {}),
    };

    const rows = await prisma.tercero.findMany({
      where,
      orderBy: [{ nombre: 'asc' }],
      take: limit,
      select: {
        id: true,
        nombre: true,
        fantasia: true,
        cuit: true,
        codigo: true,
        activo: true,
        roles: { select: { rol: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id.toString(), // 👈 el front espera string
      nombre: r.nombre,
      fantasia: r.fantasia,
      cuit: r.cuit,
      codigo: r.codigo,
      activo: r.activo,
      roles: r.roles.map((x) => x.rol),
    }));
  }

  /* =================== normalización upsert =================== */
  private normalizeUpsert(body: TerceroUpsert, actual?: any): TerceroUpsert {
    const cuit = cleanCuit(body.cuit ?? (actual?.cuit as string | undefined) ?? null);
    const condIva = body.condIva ?? (actual?.condIva as CondIva | null) ?? null;
    const tipoPersona = body.tipoPersona ?? (actual?.tipoPersona as TipoPersona | null) ?? null;

    const toDecimalOrNull = (v: unknown) =>
      v == null || v === '' ? null : new Prisma.Decimal(Number(v as number).toFixed(2));
    const toDecimalOrUndef = (v: unknown) => (v === undefined ? undefined : toDecimalOrNull(v));

    const impositivo = body.impositivo
      ? {
          exentoIva: Boolean(body.impositivo.exentoIva),
          percepIva: toDecimalOrNull(body.impositivo.percepIva),
          retGanancias: toDecimalOrNull(body.impositivo.retGanancias),
          percepIibb: toDecimalOrNull(body.impositivo.percepIibb),
        }
      : undefined;

    return {
      codigo: nn(body.codigo),
      tipoPersona,
      nombre: norm(body.nombre),
      fantasia: nn(body.fantasia),
      cuit,
      iibb: nn(body.iibb),
      condIva,
      activo: body.activo ?? true,
      notas: nn(body.notas),

      saldoInicial: toDecimalOrUndef(body.saldoInicial),
      saldoActual: toDecimalOrUndef(body.saldoActual),

      impositivo,
      direcciones: (body.direcciones ?? []).map((d) => ({
        etiqueta: nn(d.etiqueta),
        calle: nn(d.calle),
        numero: nn(d.numero),
        piso: nn(d.piso),
        dpto: nn(d.dpto),
        ciudad: nn(d.ciudad),
        provincia: nn(d.provincia),
        cp: nn(d.cp),
        pais: nn(d.pais),
        principal: Boolean(d.principal),
      })),
      contactos: (body.contactos ?? []).map((c) => ({
        tipo: c.tipo,
        valor: norm(c.valor),
        etiqueta: nn(c.etiqueta),
        principal: Boolean(c.principal),
      })),
      bancos: (body.bancos ?? []).map((b) => ({
        banco: nn(b.banco),
        tipo: b.tipo,
        numero: norm(b.numero),
        titular: nn(b.titular),
        cuitTitular: cleanCuit(b.cuitTitular),
      })),
      roles: body.roles && body.roles.length ? Array.from(new Set(body.roles)) : undefined,
    };
  }

  /* =================== Importador CSV =================== */
  mapRowToUpsert(r: CsvRow, tipo?: 'prestadores' | 'proveedores' | 'terceros'): TerceroUpsert {
    const nombre =
      nn((r.razon ?? r.nombre ?? (r as any).NOMBRE ?? (r as any).RAZON) as string | undefined) ??
      nn((r as any).DESCRIPCIO as string | undefined) ??
      '';
    const fantasia = nn((r.fantasia ?? (r as any).FANTASIA) as string | undefined);
    const codigo = nn((r.codigo ?? (r as any).CODIGO) as string | undefined);
    const cuit = cleanCuit((r.cuit ?? (r as any).CUIT) as string | undefined);
    const iibb = nn((r.iibb ?? (r as any).ingbrutos ?? (r as any).INGBRUTOS) as string | undefined);
    const condIva = mapCondIva(
      (r.cond_iva ?? (r as any).COND_IVA ?? (r as any).IVA ?? (r as any).INSCRI) as
        | string
        | undefined,
    );
    const tipoPersona = mapTipoPersona((r.tipo_persona ?? (r as any).TIPO) as string | undefined);

    const email = nn((r.email ?? (r as any).EMAIL) as string | undefined);
    const telefono = nn(
      (r.telefono ?? (r as any).celular ?? (r as any).telef ?? (r as any).TELEFONO) as
        | string
        | undefined,
    );
    const web = nn((r.web ?? (r as any).WEB) as string | undefined);

    const calle = nn(
      (r.direccion ?? (r as any).DIRECCION ?? (r as any).DOMICILIO) as string | undefined,
    );
    const numero = nn((r.numero ?? (r as any).NUMERO) as string | undefined);
    const ciudad = nn(
      (r.ciudad ?? (r as any).CIUDAD ?? (r as any).LOCALIDAD) as string | undefined,
    );
    const provincia = nn((r.provincia ?? (r as any).PROVINCIA) as string | undefined);
    const cp = nn((r.cp ?? (r as any).CP ?? (r as any).CODIGOPOST) as string | undefined);
    const pais = nn((r.pais ?? (r as any).PAIS) as string | undefined);

    const banco = nn((r.banco ?? (r as any).BANCO) as string | undefined);
    const cbu = nn((r.cbu ?? (r as any).CBU) as string | undefined);
    const alias = nn((r.alias ?? (r as any).ALIAS) as string | undefined);
    const cvu = nn((r.cvu ?? (r as any).CVU) as string | undefined);
    const cci = nn((r.cci ?? (r as any).CCI) as string | undefined);
    const titular = nn((r.titular ?? (r as any).TITULAR) as string | undefined);
    const cuitTitular = cleanCuit((r as any).cuit_titular as string | undefined);

    const saldoInicial = parseMoney((r as any).SALDO_ANT ?? null) ?? undefined;
    const saldoActual = parseMoney((r as any).SALDO_ACT ?? null) ?? undefined;

    const retGanancias = parseMoney((r as any).P_RETENCIO ?? null);

    const flags = rolesFromRow(r);
    if (tipo === 'prestadores') flags.PRESTADOR = true;
    if (tipo === 'proveedores') flags.PROVEEDOR = true;
    if (tipo === 'terceros') flags.OTRO = true;
    const hasStrong = !!(flags.PRESTADOR || flags.PROVEEDOR || flags.AFILIADO);
    if (hasStrong) flags.OTRO = false;

    const rolesArr = (Object.entries(flags) as Array<[keyof typeof flags, boolean]>)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k);
    if (rolesArr.length === 0) rolesArr.push('OTRO');

    const contactos: NonNullable<TerceroUpsert['contactos']> = [];
    if (email) contactos.push({ tipo: 'EMAIL', valor: email, principal: true });
    if (telefono) contactos.push({ tipo: 'TELEFONO', valor: telefono });
    if (web) contactos.push({ tipo: 'WEB', valor: web });

    const bancos: NonNullable<TerceroUpsert['bancos']> = [];
    if (cbu)
      bancos.push({
        banco: banco ?? undefined,
        tipo: 'CBU',
        numero: cbu,
        titular: titular ?? undefined,
        cuitTitular,
      });
    if (alias)
      bancos.push({
        banco: banco ?? undefined,
        tipo: 'ALIAS',
        numero: alias,
        titular: titular ?? undefined,
        cuitTitular,
      });
    if (cvu)
      bancos.push({
        banco: banco ?? undefined,
        tipo: 'CVU',
        numero: cvu,
        titular: titular ?? undefined,
        cuitTitular,
      });
    if (cci)
      bancos.push({
        banco: banco ?? undefined,
        tipo: 'CCI',
        numero: cci,
        titular: titular ?? undefined,
        cuitTitular,
      });

    return {
      codigo,
      tipoPersona: tipoPersona ?? null,
      nombre,
      fantasia,
      cuit,
      iibb,
      condIva: condIva ?? null,
      activo: true,
      saldoInicial,
      saldoActual,
      impositivo: retGanancias != null ? { retGanancias } : undefined,
      direcciones:
        calle || ciudad || provincia || cp || pais
          ? [{ etiqueta: 'fiscal', calle, numero, ciudad, provincia, cp, pais, principal: true }]
          : [],
      contactos,
      bancos,
      roles: rolesArr.length ? rolesArr : ['OTRO'],
    };
  }

  private detectDelimiter(buf: Buffer) {
    const first =
      buf
        .toString('utf8')
        .split(/\r?\n/)
        .find((l) => l?.trim().length) ?? '';
    return first.includes('\t') ? '\t' : first.includes(';') ? ';' : ',';
  }

  private parseCsv(buf: Buffer): CsvRow[] {
    const delimiter = this.detectDelimiter(buf);
    return parse(buf, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      delimiter,
      trim: true,
    });
  }

  importPreview(buf: Buffer, tipo?: 'prestadores' | 'proveedores' | 'terceros') {
    const rows = this.parseCsv(buf);
    const preview = rows.slice(0, 5).map((r, i) => {
      try {
        const m = this.mapRowToUpsert(r, tipo);
        if (!m.nombre) throw new Error('nombre vacío');
        return {
          idx: i + 2,
          ok: true as const,
          nombre: m.nombre,
          cuit: m.cuit ?? null,
          roles: m.roles ?? [],
        };
      } catch (e) {
        return { idx: i + 2, ok: false as const, error: (e as Error).message };
      }
    });
    return { total: rows.length, preview };
  }

  async importExecute(
    organizacionId: string,
    buf: Buffer,
    tipo?: 'prestadores' | 'proveedores' | 'terceros',
  ) {
    const rows = this.parseCsv(buf);

    let ok = 0;
    let fail = 0;
    const skip = 0;

    const errores: Array<{ idx: number; error: string; nombre?: string; cuit?: string | null }> =
      [];
    const creados: Array<{ idx: number; id: bigint; nombre: string; cuit: string | null }> = [];
    const actualizados: Array<{ idx: number; id: bigint; nombre: string; cuit: string | null }> =
      [];

    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);

      await prisma.$transaction(
        async (tx) => {
          for (let j = 0; j < slice.length; j++) {
            const idx = i + j + 2;
            try {
              const up = this.mapRowToUpsert(slice[j], tipo);
              if (!up.nombre) throw new Error('nombre vacío');

              const csvRoles = up.roles ?? [];
              const rolTarget: RolTercero =
                tipo === 'prestadores'
                  ? 'PRESTADOR'
                  : tipo === 'proveedores'
                    ? 'PROVEEDOR'
                    : csvRoles.includes('AFILIADO')
                      ? 'AFILIADO'
                      : csvRoles.includes('OTRO')
                        ? 'OTRO'
                        : (csvRoles[0] ?? 'OTRO');

              let existente: { id: bigint } | null = null;
              if (up.codigo) {
                existente = await tx.tercero.findFirst({
                  where: { organizacionId, codigo: up.codigo, roles: { some: { rol: rolTarget } } },
                  select: { id: true },
                });
              }

              const actual = existente
                ? await tx.tercero.findUnique({
                    where: { id: existente.id },
                    include: { roles: true },
                  })
                : undefined;

              const payload = this.normalizeUpsert(up, actual);
              const actuales = (actual?.roles ?? []).map((r) => r.rol);
              const unionRoles = Array.from(
                new Set<RolTercero>([...actuales, ...(payload.roles ?? []), rolTarget]),
              );
              payload.roles = unionRoles;

              let terceroId: bigint;
              if (!existente) {
                terceroId = await this.crearConTx(tx, organizacionId, payload);
                creados.push({
                  idx,
                  id: terceroId,
                  nombre: payload.nombre,
                  cuit: payload.cuit ?? null,
                });
              } else {
                await this.actualizarConTx(tx, existente.id, payload);
                terceroId = existente.id;
                actualizados.push({
                  idx,
                  id: terceroId,
                  nombre: payload.nombre,
                  cuit: payload.cuit ?? null,
                });
              }

              const txAny = tx as unknown as {
                cuentaTercero?: {
                  findFirst: (args: unknown) => Promise<{ id: bigint } | null>;
                  create: (args: unknown) => Promise<{ id: bigint }>;
                  update: (args: unknown) => Promise<unknown>;
                };
              };

              if (
                txAny.cuentaTercero &&
                (up.saldoInicial !== undefined || up.saldoActual !== undefined)
              ) {
                const cuentaId = await this.ensureCuentaByRol(
                  tx,
                  organizacionId,
                  terceroId,
                  rolTarget,
                );
                await this.upsertSaldosCuenta(tx, cuentaId, {
                  saldoInicial: up.saldoInicial,
                  saldoActual: up.saldoActual,
                });
              }

              ok++;
            } catch (e) {
              fail++;
              const row = slice[j];
              const nombre =
                nn(
                  (row?.RAZON as string | undefined) ??
                    (row?.NOMBRE as string | undefined) ??
                    (row as any)?.DESCRIPCIO,
                ) ?? undefined;
              const cuit = (row?.CUIT as string | undefined) ?? (row as any)?.cuit ?? null;
              errores.push({ idx, error: (e as Error).message, nombre, cuit });
            }
          }
        },
        { timeout: 30_000, maxWait: 60_000 },
      );
    }

    return {
      total: rows.length,
      ok,
      fail,
      skip,
      errores,
      resumen: { creados: creados.length, actualizados: actualizados.length, errores: fail },
      creados,
      actualizados,
    };
  }
}
