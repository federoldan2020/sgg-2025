/* eslint-disable no-console */
/**
 * Importa data master desde data-master.json al server actual (VPS).
 *
 *  1) Reemplaza `__ORG__` por el UUID de la org UDAP en VPS.
 *  2) Conceptos / Parentescos: upsert por `codigo` (no pisa los existentes).
 *  3) Construye mapa parentescoId local → VPS para remapear Colateral.
 *  4) ReglaPrecioCoseguro/Colateral / OrganizacionConfig: insert si no hay.
 *  5) Comercios / Afiliado / Padron / CoseguroAfiliado / Colateral: bulk
 *     insert manteniendo el `id` original (las tablas en VPS están vacías).
 *  6) Avanza las secuencias para que próximas creaciones no choquen.
 *
 *  Uso (en VPS):
 *    node src/scripts/importar-data-master-vps.js
 *    o
 *    npx ts-node src/scripts/importar-data-master-vps.ts
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();
const IN_FILE = resolve(__dirname, '..', '..', 'migration', 'data-master.json');

/** Convierte "123n" → BigInt y strings ISO → Date donde se espera Date. */
function reviveBigInts(obj: any, dateFields: string[] = []): any {
  for (const k of Object.keys(obj || {})) {
    const v = obj[k];
    if (typeof v === 'string') {
      if (/^\d+n$/.test(v)) obj[k] = BigInt(v.slice(0, -1));
      else if (dateFields.includes(k) && /^\d{4}-\d{2}-\d{2}T/.test(v)) obj[k] = new Date(v);
    } else if (v && typeof v === 'object') {
      reviveBigInts(v, dateFields);
    }
  }
  return obj;
}

const DATE_FIELDS = [
  'creadoEn', 'actualizadoEn', 'fechaAlta', 'fechaBaja', 'fechaIngreso',
  'fechaNacimiento', 'updatedAt', 'createdAt', 'vigenteDesde', 'vigenteHasta',
];

async function main() {
  // 1) UDAP VPS
  const orgUdap = await prisma.organizacion.findFirst({ where: { nombre: 'UDAP' } });
  if (!orgUdap) throw new Error('UDAP no encontrada en VPS');
  console.log(`UDAP VPS: ${orgUdap.id}`);

  // 2) Leer y reemplazar placeholder
  let raw = readFileSync(IN_FILE, 'utf8');
  raw = raw.replace(/__ORG__/g, orgUdap.id);
  const payload = JSON.parse(raw);

  // Revivir bigints + fechas
  const revive = (arr: any[]) => arr.map((r) => reviveBigInts({ ...r }, DATE_FIELDS));

  const conceptos = revive(payload.conceptos);
  const parentescos = revive(payload.parentescos);
  const comercios = revive(payload.comercios);
  const afiliados = revive(payload.afiliados);
  const padrones = revive(payload.padrones);
  const coseguros = revive(payload.coseguros);
  const colaterales = revive(payload.colaterales);
  const reglasCos = revive(payload.reglasCos);
  const reglasCol = revive(payload.reglasCol);
  const orgConfig = revive(payload.orgConfig);

  console.log('\n--- Datos a importar ---');
  console.log(`Conceptos:    ${conceptos.length}`);
  console.log(`Parentescos:  ${parentescos.length}`);
  console.log(`Comercios:    ${comercios.length}`);
  console.log(`Afiliados:    ${afiliados.length}`);
  console.log(`Padrones:     ${padrones.length}`);
  console.log(`Coseguros:    ${coseguros.length}`);
  console.log(`Colaterales:  ${colaterales.length}`);
  console.log(`Reglas Cos:   ${reglasCos.length}`);
  console.log(`Reglas Col:   ${reglasCol.length}`);
  console.log(`OrgConfig:    ${orgConfig.length}`);

  // ─── 3) Conceptos por codigo (upsert) ─────────────────────────
  console.log('\n→ Conceptos…');
  let conceptosCreados = 0;
  for (const c of conceptos) {
    const exist = await prisma.concepto.findFirst({
      where: { organizacionId: orgUdap.id, codigo: c.codigo },
      select: { id: true },
    });
    if (!exist) {
      const { id, ...rest } = c;
      void id;
      await prisma.concepto.create({ data: rest });
      conceptosCreados++;
    }
  }
  console.log(`   creados ${conceptosCreados}, ya existían ${conceptos.length - conceptosCreados}`);

  // ─── 4) Parentescos por codigo + mapa local→VPS ───────────────
  console.log('\n→ Parentescos…');
  const mapaParentesco = new Map<string, bigint>();
  let parentCreados = 0;
  for (const p of parentescos) {
    const exist = await prisma.parentesco.findFirst({
      where: { organizacionId: orgUdap.id, codigo: p.codigo },
      select: { id: true },
    });
    if (exist) {
      mapaParentesco.set(p.id.toString(), exist.id);
    } else {
      const { id, ...rest } = p;
      void id;
      const created = await prisma.parentesco.create({ data: rest, select: { id: true } });
      mapaParentesco.set(p.id.toString(), created.id);
      parentCreados++;
    }
  }
  console.log(`   creados ${parentCreados}, mapeados ${mapaParentesco.size}`);

  // ─── 5) Reglas / OrganizacionConfig ───────────────────────────
  console.log('\n→ Reglas / config…');
  for (const r of reglasCos) {
    const exist = await prisma.reglaPrecioCoseguro.count({
      where: { organizacionId: orgUdap.id, vigenteDesde: r.vigenteDesde },
    });
    if (!exist) {
      const { id, ...rest } = r;
      void id;
      await prisma.reglaPrecioCoseguro.create({ data: rest });
    }
  }
  for (const r of reglasCol) {
    const exist = await prisma.reglaPrecioColateral.count({
      where: {
        organizacionId: orgUdap.id,
        parentescoId: mapaParentesco.get(r.parentescoId.toString()) ?? r.parentescoId,
        vigenteDesde: r.vigenteDesde,
      },
    });
    if (!exist) {
      const { id, parentescoId, ...rest } = r;
      void id;
      await prisma.reglaPrecioColateral.create({
        data: { ...rest, parentescoId: mapaParentesco.get(parentescoId.toString()) ?? parentescoId },
      });
    }
  }
  for (const c of orgConfig) {
    const exist = await prisma.organizacionConfig.findFirst({
      where: { organizacionId: orgUdap.id, clave: c.clave },
    });
    if (!exist) {
      const { id, ...rest } = c;
      void id;
      await prisma.organizacionConfig.create({ data: rest });
    }
  }
  console.log(`   reglas + config OK`);

  // ─── 6) Comercios (bulk con id original) ──────────────────────
  console.log('\n→ Comercios…');
  await prisma.comercio.createMany({ data: comercios, skipDuplicates: true });
  console.log(`   ${comercios.length} insertados`);

  // ─── 7) Afiliados ─────────────────────────────────────────────
  console.log('\n→ Afiliados…');
  const CHUNK = 500;
  for (let i = 0; i < afiliados.length; i += CHUNK) {
    await prisma.afiliado.createMany({
      data: afiliados.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    process.stdout.write(`   ${Math.min(i + CHUNK, afiliados.length)}/${afiliados.length}\r`);
  }
  console.log('\n   afiliados OK');

  // ─── 8) Padrones ──────────────────────────────────────────────
  console.log('\n→ Padrones…');
  for (let i = 0; i < padrones.length; i += CHUNK) {
    await prisma.padron.createMany({
      data: padrones.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    process.stdout.write(`   ${Math.min(i + CHUNK, padrones.length)}/${padrones.length}\r`);
  }
  console.log('\n   padrones OK');

  // ─── 9) CoseguroAfiliado ──────────────────────────────────────
  console.log('\n→ CoseguroAfiliado…');
  await prisma.coseguroAfiliado.createMany({ data: coseguros, skipDuplicates: true });
  console.log(`   ${coseguros.length} insertados`);

  // ─── 10) Colateral (remapeando parentescoId) ──────────────────
  console.log('\n→ Colaterales (remapeo parentescoId)…');
  const colateralesRemap = colaterales.map((c) => ({
    ...c,
    parentescoId:
      mapaParentesco.get(c.parentescoId.toString()) ?? c.parentescoId,
  }));
  for (let i = 0; i < colateralesRemap.length; i += CHUNK) {
    await prisma.colateral.createMany({
      data: colateralesRemap.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
    process.stdout.write(`   ${Math.min(i + CHUNK, colateralesRemap.length)}/${colateralesRemap.length}\r`);
  }
  console.log('\n   colaterales OK');

  // ─── 11) Avanzar secuencias para que próximas inserciones no choquen ──
  console.log('\n→ Avanzando secuencias…');
  const tablas = [
    'Concepto', 'Parentesco', 'Comercio', 'Afiliado', 'Padron',
    'CoseguroAfiliado', 'Colateral', 'ReglaPrecioCoseguro',
    'ReglaPrecioColateral', 'OrganizacionConfig',
  ];
  for (const t of tablas) {
    const seq = `${t}_id_seq`;
    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval('"${seq}"', COALESCE((SELECT MAX(id) FROM "${t}"), 1));`,
      );
    } catch (e) {
      console.log(`   ⚠️ ${seq} ${(e as Error).message.slice(0, 60)}`);
    }
  }
  console.log('   secuencias OK');

  console.log('\n✅ Migración completa.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
