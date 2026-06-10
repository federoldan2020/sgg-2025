/* eslint-disable no-console */
/**
 * Asigna `Padron.sistema` según `Padron.situacion`:
 *   - situacion='04'  → sistema='04'  (no genera novedades a Cómputos)
 *   - situacion='PP'  → sistema='PP'
 *   - resto           → se respeta lo existente (no se toca)
 *
 * Idempotente.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organizacion.findFirst({ where: { nombre: 'UDAP' } });
  if (!org) throw new Error('Org UDAP no encontrada');

  // 1) Distribución actual por situación.
  const grupos = await prisma.padron.groupBy({
    by: ['situacion'],
    where: { organizacionId: org.id },
    _count: { _all: true },
  });
  console.log('Distribución actual por situación:');
  for (const g of grupos.sort((a, b) => (b._count._all ?? 0) - (a._count._all ?? 0))) {
    console.log(`  ${(g.situacion ?? '(NULL)').padEnd(12)} → ${g._count._all}`);
  }

  // 2) Actualizar 04
  const u04 = await prisma.padron.updateMany({
    where: {
      organizacionId: org.id,
      situacion: '04',
      NOT: { sistema: 'CERO_CUATRO' },
    },
    data: { sistema: 'CERO_CUATRO' },
  });
  console.log(`\n✅ Padrones con situacion='04' actualizados a sistema='04': ${u04.count}`);

  // 3) Actualizar PP (varias formas comunes)
  const uPP = await prisma.padron.updateMany({
    where: {
      organizacionId: org.id,
      situacion: { in: ['PP', 'pp'] },
      NOT: { sistema: 'PP' },
    },
    data: { sistema: 'PP' },
  });
  console.log(`✅ Padrones con situacion='PP' actualizados a sistema='PP': ${uPP.count}`);

  // 4) Distribución final por sistema
  const finalSistema = await prisma.padron.groupBy({
    by: ['sistema'],
    where: { organizacionId: org.id },
    _count: { _all: true },
  });
  console.log('\nDistribución final por sistema:');
  for (const g of finalSistema.sort((a, b) => (b._count._all ?? 0) - (a._count._all ?? 0))) {
    console.log(`  ${(g.sistema ?? '(NULL)').padEnd(15)} → ${g._count._all}`);
  }

  // 5) Conteos clave para el generador de novedades ESC
  const escActivos = await prisma.padron.count({
    where: { organizacionId: org.id, sistema: 'ESC', activo: true },
  });
  console.log(`\n➡️  ESC + activos (los que van al archivo de novedades): ${escActivos}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
