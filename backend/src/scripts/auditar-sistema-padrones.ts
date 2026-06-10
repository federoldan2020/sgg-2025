/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organizacion.findMany({ select: { id: true, nombre: true } });

  for (const org of orgs) {
    const total = await prisma.padron.count({ where: { organizacionId: org.id } });
    const activos = await prisma.padron.count({
      where: { organizacionId: org.id, activo: true },
    });
    const escActivos = await prisma.padron.count({
      where: { organizacionId: org.id, activo: true, sistema: 'ESC' },
    });

    const grupos = await prisma.padron.groupBy({
      by: ['sistema'],
      where: { organizacionId: org.id },
      _count: { _all: true },
    });

    console.log('═══════════════════════════════════════════════════════');
    console.log(`Org: ${org.nombre}  (${org.id})`);
    console.log(`  Padrones totales: ${total}`);
    console.log(`  Padrones activos: ${activos}`);
    console.log(`  Padrones ESC + activos: ${escActivos}`);
    console.log(`  Distribución por sistema (todos):`);
    for (const g of grupos.sort((a, b) => (b._count._all ?? 0) - (a._count._all ?? 0))) {
      const label = g.sistema ?? '(NULL)';
      console.log(`    ${label.padEnd(12)} → ${g._count._all}`);
    }

    // Distribución por situacion para los ESC
    if (escActivos > 0) {
      const sitGroup = await prisma.padron.groupBy({
        by: ['situacion'],
        where: { organizacionId: org.id, sistema: 'ESC', activo: true },
        _count: { _all: true },
      });
      console.log('  ESC activos por situación:');
      for (const g of sitGroup.sort((a, b) => (b._count._all ?? 0) - (a._count._all ?? 0))) {
        console.log(`    ${(g.situacion ?? '(NULL)').padEnd(12)} → ${g._count._all}`);
      }
    }

    // Coseguro activos
    const coseguroAct = await prisma.coseguroAfiliado.count({
      where: { organizacionId: org.id, estado: 'activo' },
    });
    console.log(`  Coseguros activos: ${coseguroAct}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
