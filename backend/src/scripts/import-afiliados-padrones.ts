/* eslint-disable @typescript-eslint/no-floating-promises */
import path from 'path';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { PrismaClient, Prisma, Sistema, Sexo } from '@prisma/client';
import { parse as parseDate, isValid } from 'date-fns';
import iconv from 'iconv-lite';

const prisma = new PrismaClient();

// ===== Config =====
// CSV por defecto en la MISMA carpeta del script: scripts/AFILIADO1.csv
const CSV_PATH = process.env.CSV_PATH || path.resolve(__dirname, 'AFILIADO1.csv');

const ORGANIZACION_ID =
  process.env.ORG_ID || process.argv.find((a) => a.startsWith('--org='))?.split('=')[1] || '';

const BATCH_SIZE = Number(process.env.BATCH_SIZE || 300);
const DRY_RUN = process.env.DRY_RUN === '1';

// ===== Normalización mínima =====
const clean = (s?: string | null) => (s ?? '').trim();
const upper = (s?: string | null) => clean(s).toUpperCase();
const onlyDigits = (s?: string | null) => clean(s).replace(/\D+/g, '');

// "1.234,56" | "1234.56" | "1234" -> "1234.56"
const toDecimalStr = (s?: string | null) => {
  const raw = clean(s);
  if (!raw) return undefined;
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  if (Number.isNaN(n)) return undefined;
  return n.toFixed(2);
};

// DD/MM/YYYY | DD-MM-YYYY | YYYY-MM-DD | YYYY/MM/DD -> "YYYY-MM-DD"
const tryParseDate = (s?: string | null): string | undefined => {
  const raw = clean(s);
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw; // ya ISO

  const patterns = ['dd/MM/yyyy', 'dd-MM-yyyy', 'yyyy-MM-dd', 'yyyy/MM/dd'];
  for (const p of patterns) {
    const d = parseDate(raw, p, new Date());
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    if (isValid(d)) return d.toISOString().slice(0, 10);
  }
  return undefined;
};

const mapSistema = (s?: string | null): Sistema | undefined => {
  const v = upper(s);
  if (v === 'ESC' || v === 'SGR' || v === 'SG') return v as Sistema;
  return undefined; // si viene algo raro, no pisamos
};

const mapSexo = (s?: string | null): Sexo | undefined => {
  const v = upper(s);
  if (v === 'M' || v === 'F' || v === 'X') return v as Sexo;
  return undefined;
};

// ===== Tipos internos =====
type RowIn = Record<string, string>;

type AfiliadoDTO = {
  dni: string; // solo dígitos
  apellido: string; // quedará vacío a pedido
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
  fechaAlta?: string; // YYYY-MM-DD
  fechaBaja?: string; // YYYY-MM-DD
  j17?: string; // decimal string
  j22?: string;
  j38?: string;
  k16?: string;
};

// === Mapeo EXACTO a tu CSV ===
// - DOCUMENTO -> dni
// - APE_NOM -> (apellido="", nombre=APE_NOM completo)
// - PADRON, SITUACION, SISTEMA, CENTRO, SECTOR, CLASE
// - FECHA_ING (alta), FECHA_EG (baja)
// - J17, J22, J38, K16
// - TELEFONO1, TELEFONO2, SEXO, CUIT, SOCIO
function mapRow(r: RowIn): { afiliado: AfiliadoDTO; padron: PadronDTO } {
  const dni = onlyDigits(r.DOCUMENTO || r.documento);
  const cuit = onlyDigits(r.CUIT || r.cuit);

  const nombreCompleto = upper(r.APE_NOM || r.apenom || r.apellido || r.nombre);
  const apellido = ''; // pedido: NO heurística, apellido vacío
  const nombre = nombreCompleto; // todo APE_NOM va a nombre

  const padron = clean(r.PADRON || r.padron);
  const sistema = mapSistema(r.SISTEMA || r.sistema);
  const centro = Number(clean(r.CENTRO)) || undefined;
  const sector = Number(clean(r.SECTOR)) || undefined;
  const clase = clean(r.CLASE);
  const situacion = clean(r.SITUACION);

  const fechaAlta = tryParseDate(r.FECHA_ING || r.fechaAlta);
  const fechaBaja = tryParseDate(r.FECHA_EG || r.fechaBaja);

  const j17 = toDecimalStr(r.J17);
  const j22 = toDecimalStr(r.J22);
  const j38 = toDecimalStr(r.J38);
  const k16 = toDecimalStr(r.K16);

  const telefono = clean(r.TELEFONO1);
  const celular = clean(r.TELEFONO2 || r.CELULAR);
  const numeroSocio = clean(r.SOCIO);

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

// ===== Proceso por lotes =====
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

    // === Afiliado (una sola vez por corrida/memoria)
    const kAf = `${orgId}|${afiliado.dni}`;
    if (!seenA.has(kAf)) {
      seenA.add(kAf);

      const updateA: Prisma.AfiliadoUpdateInput = {
        // apellido queda vacío por pedido; si ya hay uno en DB no lo pisamos con vacío
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
        // en alta inicial, seteo el apellido vacío como pediste
        apellido: '',
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

    // === Padrón (una sola vez por corrida/memoria)
    const kPa = `${orgId}|${padron.padron}`;
    if (!seenP.has(kPa)) {
      seenP.add(kPa);

      const updateP: Prisma.PadronUpdateInput = {
        sistema: padron.sistema || undefined,
        centro: padron.centro ?? undefined,
        sector: padron.sector ?? undefined,
        clase: padron.clase || undefined,
        situacion: padron.situacion || undefined,
        fechaAlta: padron.fechaAlta ? new Date(padron.fechaAlta) : undefined,
        fechaBaja: padron.fechaBaja ? new Date(padron.fechaBaja) : undefined,
        j17: padron.j17 !== undefined ? new Prisma.Decimal(padron.j17) : undefined,
        j22: padron.j22 !== undefined ? new Prisma.Decimal(padron.j22) : undefined,
        j38: padron.j38 !== undefined ? new Prisma.Decimal(padron.j38) : undefined,
        k16: padron.k16 !== undefined ? new Prisma.Decimal(padron.k16) : undefined,
        // no tocamos 'activo' en update para no sobreescribir lógica previa
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
        fechaAlta: padron.fechaAlta ? new Date(padron.fechaAlta) : null,
        fechaBaja: padron.fechaBaja ? new Date(padron.fechaBaja) : null,
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
    console.log(`(dry-run) aplicaría ${ops.length} operaciones`);
    counters.skipped += ops.length;
    return;
  }

  // Prisma: usar sobrecarga de array, sin 'timeout'
  await prisma.$transaction(ops);
  counters.applied += ops.length;
}

async function main(): Promise<void> {
  if (!ORGANIZACION_ID) {
    throw new Error('Falta ORG_ID. Usa --org=<uuid> o env ORG_ID.');
  }

  console.log(`Importando ${CSV_PATH} -> organizacionId=${ORGANIZACION_ID}`);
  if (DRY_RUN) console.log('** DRY RUN ACTIVADO **');

  const seenAfiliado = new Set<string>();
  const seenPadron = new Set<string>();
  const counters = { total: 0, applied: 0, skipped: 0, invalid: 0 };

  const batch: WorkItem[] = [];

  await new Promise<void>((resolve, reject) => {
    const fileStream = createReadStream(CSV_PATH); // sin encoding acá
    const decoded = fileStream.pipe(iconv.decodeStream('win1252')); // o "latin1" si preferís

    const parser = parse({
      columns: true,
      bom: true,
      skip_empty_lines: true,
      delimiter: '\t', // <<--- si exportás con TAB
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
      skip_records_with_error: true,
    });

    decoded.pipe(parser);

    parser
      .on('data', (row: RowIn) => {
        try {
          const mapped = mapRow(row);
          if (!mapped.afiliado.dni || !mapped.padron.padron) {
            counters.invalid++;
            return;
          }

          batch.push(mapped);

          if (batch.length >= BATCH_SIZE) {
            parser.pause(); // pausar lectura mientras aplicamos el batch
            applyBatch(
              prisma,
              ORGANIZACION_ID,
              batch.splice(0, batch.length),
              seenAfiliado,
              seenPadron,
              counters,
            )
              .then(() => parser.resume())
              .catch((e) =>
                reject(new Error(`Fallo aplicando batch: ${String((e as Error)?.message || e)}`)),
              );
          }
        } catch (e: unknown) {
          console.error('Error mapeando fila:', e);
          counters.invalid++;
        }
      })
      .on('end', async () => {
        try {
          await applyBatch(
            prisma,
            ORGANIZACION_ID,
            batch.splice(0, batch.length),
            seenAfiliado,
            seenPadron,
            counters,
          );
          resolve();
        } catch (e) {
          reject(new Error(`Fallo aplicando último batch: ${String((e as Error)?.message || e)}`));
        }
      })
      .on('error', (e) => {
        reject(new Error(`Stream error: ${String(e?.message || e)}`));
      });
  });

  console.log('==== RESUMEN ====');
  console.log({
    totalFilasLeidas: counters.total,
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
