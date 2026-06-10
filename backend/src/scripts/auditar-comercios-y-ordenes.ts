/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organizacion.findFirst({ where: { nombre: 'UDAP' } });
  if (!org) throw new Error('UDAP no encontrada');

  const totalCom = await prisma.comercio.count({ where: { organizacionId: org.id } });
  const activos = await prisma.comercio.count({
    where: { organizacionId: org.id, OR: [{ baja: false }, { baja: null }] },
  });
  const totalOrdenes = await prisma.ordenCredito.count({ where: { organizacionId: org.id } });
  const ordenesActivas = await prisma.ordenCredito.count({
    where: { organizacionId: org.id, estado: { in: ['pendiente', 'en_curso'] } },
  });

  console.log('═══════════════════════════════════════');
  console.log(`Comercios totales:  ${totalCom}`);
  console.log(`Comercios activos:  ${activos}`);
  console.log(`Órdenes totales:    ${totalOrdenes}`);
  console.log(`Órdenes en curso:   ${ordenesActivas}`);
  console.log('═══════════════════════════════════════');

  if (totalCom > 0) {
    const lista = await prisma.comercio.findMany({
      where: { organizacionId: org.id },
      take: 10,
      select: { id: true, codigo: true, razonSocial: true, cuoMax: true, baja: true },
      orderBy: { codigo: 'asc' },
    });
    console.log('\nPrimeros 10 comercios:');
    for (const c of lista) {
      console.log(
        `  id=${c.id.toString().padStart(4)}  cod=${(c.codigo ?? '').padEnd(10)}  ` +
          `razon=${(c.razonSocial ?? '').slice(0, 40).padEnd(40)}  ` +
          `cuoMax=${c.cuoMax ?? '-'}  baja=${c.baja ?? '-'}`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
