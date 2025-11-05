/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-control-regex */
/* eslint-disable @typescript-eslint/no-base-to-string */
/* eslint-disable @typescript-eslint/no-floating-promises */
import path from 'path';
import { PrismaClient, Prisma, Sistema, Sexo } from '@prisma/client';
import { DBFFile } from 'dbffile';
import iconv from 'iconv-lite';

const prisma = new PrismaClient();

// ===== Config =====
const DBF_PATH =
  process.env.DBF_PATH ||
  process.argv.find((a) => a.startsWith('--dbf='))?.split('=')[1] ||
  path.resolve(__dirname, 'AFILIADO1.dbf'); // por defecto junto al script

const ORGANIZACION_ID =
  process.env.ORG_ID || process.argv.find((a) => a.startsWith('--org='))?.split('=')[1] || '';

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 300);
const DRY_RUN = process.env.DRY_RUN === '1';

// ===== Utils =====
const clean = (s?: unknown) => (s ?? '').toString().trim();

// Sanitiza para Postgres UTF-8: quita NUL (0x00) y otros controles (excepto \n \r \t)
const sanitizeUtf8 = (s?: unknown): string => {
  let str = (s ?? '').toString();
  // si vino como Buffer en algún campo raro, decodificamos cp1252
  if (str && Buffer.isBuffer(s)) {
    str = iconv.decode(s as unknown as Buffer, 'cp1252');
  }
  // eliminar NUL y controles problemáticos
  str = str.replace(/\u0000/g, ''); // NUL
  str = str.replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, ' '); // otros controles
  // normalizar espacios
  str = str
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .trim();
  return str;
};

const upper = (s?: unknown) => sanitizeUtf8(s).toUpperCase();
const onlyDigits = (s?: unknown) => sanitizeUtf8(s).replace(/\D+/g, '');

// "1.234,56" | "1234.56" | 1234 -> "1234.56"
const toDecimalStr = (v: unknown) => {
  const raw = sanitizeUtf8(v);
  if (!raw) return undefined;
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (Number.isNaN(n)) return undefined;
  return n.toFixed(2);
};

// Map enum Sistema
const mapSistema = (s?: unknown): Sistema | undefined => {
  const v = upper(s);
  if (v === 'ESC' || v === 'SGR' || v === 'SG') return v as Sistema;
  return undefined;
};

// Map enum Sexo
const mapSexo = (s?: unknown): Sexo | undefined => {
  const v = upper(s);
  if (v === 'M' || v === 'F' || v === 'X') return v as Sexo;
  return undefined;
};

// FoxPro date -> JS Date | undefined
const toDate = (d: unknown): Date | undefined => {
  if (d instanceof Date && !isNaN(d.getTime())) return d;
  const s = sanitizeUtf8(d);
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
    return isNaN(dt.getTime()) ? undefined : dt;
  }
  return undefined;
};

// ===== Tipos internos =====
type RowIn = Record<string, any>;

type AfiliadoDTO = {
  dni: string; // solo dígitos
  apellido: string; // vacío (pedido)
  nombre: string; // APE_NOM completo
  cuit?: string;
  sexo?: Sexo;
  telefono?: string;
  celular?: string;
  numeroSocio?: string;
};

type PadronDTO = {
  padron: string;
  sistema?: Sistema;
  centro?: number;
  sector?: number;
  clase?: string;
  situacion?: string;
  fechaAlta?: Date;
  fechaBaja?: Date;
  j17?: string;
  j22?: string;
  j38?: string;
  k16?: string;
};

// Mapea una fila del DBF a nuestros DTOs
function mapRow(rRaw: RowIn): { afiliado: AfiliadoDTO; padron: PadronDTO } {
  const r: RowIn = {};
  // sanitizamos todos los stringy antes de usar
  for (const k of Object.keys(rRaw)) {
    const v = rRaw[k];
    r[k] = Buffer.isBuffer(v) ? iconv.decode(v, 'cp1252') : v;
  }

  const dni = onlyDigits(r.DOCUMENTO ?? r.documento);
  const cuit = onlyDigits(r.CUIT ?? r.cuit);

  // Pedido: apellido = "", nombre = APE_NOM completo (en mayúsculas)
  const nombre = upper(r.APE_NOM ?? r.apenom ?? r.nombre ?? r.apellido);
  const apellido = '';

  const padron = sanitizeUtf8(r.PADRON ?? r.padron);
  const sistema = mapSistema(r.SISTEMA ?? r.sistema);

  const centroRaw = Number(onlyDigits(r.CENTRO));
  const centro = Number.isNaN(centroRaw) ? undefined : centroRaw;

  const sectorRaw = Number(onlyDigits(r.SECTOR));
  const sector = Number.isNaN(sectorRaw) ? undefined : sectorRaw;

  const clase = sanitizeUtf8(r.CLASE);
  const situacion = sanitizeUtf8(r.SITUACION);
  const fechaAlta = toDate(r.FECHA_ING ?? r.fechaAlta);
  const fechaBaja = toDate(r.FECHA_EG ?? r.fechaBaja);

  const j17 = toDecimalStr(r.J17);
  const j22 = toDecimalStr(r.J22);
  const j38 = toDecimalStr(r.J38);
  const k16 = toDecimalStr(r.K16);

  const telefono = sanitizeUtf8(r.TELEFONO1);
  const celular = sanitizeUtf8(r.TELEFONO2 ?? r.CELULAR);
  const numeroSocio = sanitizeUtf8(r.SOCIO);

  return {
    afiliado: {
      dni,
      apellido,
      nombre,
      cuit,
      sexo: mapSexo(r.SEXO),
      telefono,
      celular,
      numeroSocio,
    },
    padron: {
      padron,
      sistema,
      centro,
      sector,
      clase,
      situacion,
      fechaAlta,
      fechaBaja,
      j17,
      j22,
      j38,
      k16,
    },
  };
}

// ===== Batch import =====
type WorkItem = ReturnType<typeof mapRow>;

async function applyBatch(
  client: PrismaClient,
  orgId: string,
  items: WorkItem[],
  seenA: Set<string>,
  seenP: Set<string>,
  counters: { total: number; applied: number; skipped: number; invalid: number },
): Promise<void> {
  if (!items.length) return;
  counters.total += items.length;

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  for (const it of items) {
    const { afiliado, padron } = it;
    if (!afiliado.dni || !padron.padron) {
      counters.invalid++;
      continue;
    }

    // Afiliado (unique por org+dni) — upsert una sola vez por corrida
    const kAf = `${orgId}|${afiliado.dni}`;
    if (!seenA.has(kAf)) {
      seenA.add(kAf);

      const updateA: Prisma.AfiliadoUpdateInput = {
        // no pisamos con vacío
        apellido: afiliado.apellido ? afiliado.apellido : undefined,
        nombre: afiliado.nombre || undefined,
        cuit: afiliado.cuit || undefined,
        sexo: afiliado.sexo || undefined,
        telefono: afiliado.telefono || undefined,
        celular: afiliado.celular || undefined,
        numeroSocio: afiliado.numeroSocio || undefined,
      };

      const createA: Prisma.AfiliadoCreateInput = {
        organizacion: { connect: { id: orgId } },
        dni: BigInt(afiliado.dni),
        apellido: '', // pedido
        nombre: afiliado.nombre || '',
        cuit: afiliado.cuit || null,
        sexo: afiliado.sexo || null,
        telefono: afiliado.telefono || null,
        celular: afiliado.celular || null,
        numeroSocio: afiliado.numeroSocio || null,
      };

      ops.push(
        client.afiliado.upsert({
          where: { organizacionId_dni: { organizacionId: orgId, dni: BigInt(afiliado.dni) } },
          update: updateA,
          create: createA,
        }),
      );
    }

    // Padrón (unique por org+padron) — upsert una sola vez por corrida
    const kPa = `${orgId}|${padron.padron}`;
    if (!seenP.has(kPa)) {
      seenP.add(kPa);

      const updateP: Prisma.PadronUpdateInput = {
        sistema: padron.sistema || undefined,
        centro: padron.centro ?? undefined,
        sector: padron.sector ?? undefined,
        clase: padron.clase || undefined,
        situacion: padron.situacion || undefined,
        fechaAlta: padron.fechaAlta ?? undefined,
        fechaBaja: padron.fechaBaja ?? undefined,
        j17: padron.j17 !== undefined ? new Prisma.Decimal(padron.j17) : undefined,
        j22: padron.j22 !== undefined ? new Prisma.Decimal(padron.j22) : undefined,
        j38: padron.j38 !== undefined ? new Prisma.Decimal(padron.j38) : undefined,
        k16: padron.k16 !== undefined ? new Prisma.Decimal(padron.k16) : undefined,
        // no tocamos 'activo' aquí
      };

      const createP: Prisma.PadronCreateInput = {
        organizacion: { connect: { id: orgId } },
        afiliado: {
          connect: { organizacionId_dni: { organizacionId: orgId, dni: BigInt(afiliado.dni) } },
        },
        padron: padron.padron,
        sistema: padron.sistema ?? null,
        centro: padron.centro ?? null,
        sector: padron.sector ?? null,
        clase: padron.clase ?? null,
        situacion: padron.situacion ?? null,
        fechaAlta: padron.fechaAlta ?? null,
        fechaBaja: padron.fechaBaja ?? null,
        j17: new Prisma.Decimal(padron.j17 ?? '0'),
        j22: new Prisma.Decimal(padron.j22 ?? '0'),
        j38: new Prisma.Decimal(padron.j38 ?? '0'),
        k16: new Prisma.Decimal(padron.k16 ?? '0'),
        activo: padron.fechaBaja ? false : true,
      };

      ops.push(
        client.padron.upsert({
          where: { organizacionId_padron: { organizacionId: orgId, padron: padron.padron } },
          update: updateP,
          create: createP,
        }),
      );
    }
  }

  if (!ops.length) return;
  if (DRY_RUN) {
    counters.skipped += ops.length;
    return;
  }

  await client.$transaction(ops);
  counters.applied += ops.length;
}

async function main(): Promise<void> {
  if (!ORGANIZACION_ID) throw new Error('Falta ORG_ID. Usa --org=<uuid> o env ORG_ID.');

  console.log(`Importando DBF=${DBF_PATH} -> organizacionId=${ORGANIZACION_ID}`);
  if (DRY_RUN) console.log('** DRY RUN ACTIVADO **');

  const seenAfiliado = new Set<string>();
  const seenPadron = new Set<string>();
  const counters = { total: 0, applied: 0, skipped: 0, invalid: 0 };

  // Abrir DBF (encoding típico de FoxPro)
  const dbf = await DBFFile.open(DBF_PATH, { encoding: 'cp1252' });
  console.log(`Campos: ${dbf.fields.map((f) => f.name).join(', ')}`);
  console.log(`Registros informados por DBF: ${dbf.recordCount}`);

  // Leer en tandas
  while (true) {
    const rows: RowIn[] = await dbf.readRecords(BATCH_SIZE);
    if (!rows.length) break;

    const batch: WorkItem[] = [];
    for (const row of rows) {
      // Filtrado defensivo por si tu lib devolviera borrados (no debería)
      const deleted =
        (row as any).deleted === true ||
        (row as any).DELETED === true ||
        (row as any).DeletionFlag === true ||
        (row as any).$isDeleted === true;
      if (deleted) continue;

      try {
        const mapped = mapRow(row);
        if (!mapped.afiliado.dni || !mapped.padron.padron) {
          counters.invalid++;
          continue;
        }
        batch.push(mapped);
      } catch {
        counters.invalid++;
      }
    }

    await applyBatch(prisma, ORGANIZACION_ID, batch, seenAfiliado, seenPadron, counters);
  }

  console.log('==== RESUMEN ====');
  console.log({
    registrosDBF: counters.total,
    operacionesAplicadas: counters.applied,
    operacionesSimuladas: counters.skipped,
    filasInvalidas: counters.invalid,
    afiliadosUnicos: seenAfiliado.size,
    padronesUnicos: seenPadron.size,
  });
}

main()
  .catch(async (e: unknown) => {
    console.error('Fallo general:', e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
