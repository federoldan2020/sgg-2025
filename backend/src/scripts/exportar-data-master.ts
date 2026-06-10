/* eslint-disable no-console */
/**
 * Exporta data master de UDAP local → JSON único.
 * Reemplaza el `organizacionId` por el placeholder __ORG__ para que
 * el importador en VPS lo reemplace por el orgId real de UDAP allá.
 *
 * Output: ./migration/data-master.json
 *
 * Uso:  npx ts-node src/scripts/exportar-data-master.ts
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();
const OUT_DIR = resolve(__dirname, '..', '..', 'migration');
const OUT_FILE = resolve(OUT_DIR, 'data-master.json');
const ORG_PLACEHOLDER = '__ORG__';

function bigintReplacer(_k: string, v: unknown): unknown {
  if (typeof v === 'bigint') return v.toString() + 'n';
  if (v instanceof Date) return v.toISOString();
  return v;
}

async function main() {
  const org = await prisma.organizacion.findFirst({ where: { nombre: 'UDAP' } });
  if (!org) throw new Error('UDAP no encontrada en local');
  const orgId = org.id;
  console.log(`UDAP local: ${orgId}`);
  console.log(`Reemplazaré ese UUID por "${ORG_PLACEHOLDER}" en el JSON.\n`);

  const conceptos = await prisma.concepto.findMany({ where: { organizacionId: orgId } });
  const parentescos = await prisma.parentesco.findMany({ where: { organizacionId: orgId } });
  const comercios = await prisma.comercio.findMany({ where: { organizacionId: orgId } });
  const afiliados = await prisma.afiliado.findMany({ where: { organizacionId: orgId } });
  const padrones = await prisma.padron.findMany({ where: { organizacionId: orgId } });
  const coseguros = await prisma.coseguroAfiliado.findMany({ where: { organizacionId: orgId } });
  const colaterales = await prisma.colateral.findMany({
    where: { afiliado: { organizacionId: orgId } },
  });
  const reglasCos = await prisma.reglaPrecioCoseguro.findMany({ where: { organizacionId: orgId } });
  const reglasCol = await prisma.reglaPrecioColateral.findMany({ where: { organizacionId: orgId } });
  const orgConfig = await prisma.organizacionConfig.findMany({ where: { organizacionId: orgId } });

  console.log(`Conceptos:           ${conceptos.length}`);
  console.log(`Parentescos:         ${parentescos.length}`);
  console.log(`Comercios:           ${comercios.length}`);
  console.log(`Afiliados:           ${afiliados.length}`);
  console.log(`Padrones:            ${padrones.length}`);
  console.log(`CoseguroAfiliado:    ${coseguros.length}`);
  console.log(`Colateral:           ${colaterales.length}`);
  console.log(`ReglaPrecioCoseguro: ${reglasCos.length}`);
  console.log(`ReglaPrecioColateral:${reglasCol.length}`);
  console.log(`OrganizacionConfig:  ${orgConfig.length}`);

  const payload = {
    sourceOrgId: orgId,
    placeholder: ORG_PLACEHOLDER,
    exportadoEn: new Date().toISOString(),
    conceptos,
    parentescos,
    comercios,
    afiliados,
    padrones,
    coseguros,
    colaterales,
    reglasCos,
    reglasCol,
    orgConfig,
  };

  // Convertir a JSON y reemplazar todas las apariciones del UUID local.
  let json = JSON.stringify(payload, bigintReplacer, 0);
  // Escapado RegExp para reemplazar el UUID literal.
  const re = new RegExp(orgId.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g');
  json = json.replace(re, ORG_PLACEHOLDER);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, json, 'utf8');
  console.log(`\n✅ Export → ${OUT_FILE}`);
  console.log(`   tamaño: ${(json.length / 1024).toFixed(1)} KB`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
