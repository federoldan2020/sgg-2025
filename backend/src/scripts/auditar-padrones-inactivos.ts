/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organizacion.findFirst({ where: { nombre: 'UDAP' } });
  if (!org) throw new Error('Org UDAP no encontrada');

  const total = await prisma.padron.count({ where: { organizacionId: org.id } });
  const activos = await prisma.padron.count({
    where: { organizacionId: org.id, activo: true },
  });
  const inactivos = await prisma.padron.count({
    where: { organizacionId: org.id, activo: false },
  });
  console.log(`Totales: ${total} | activos: ${activos} | inactivos: ${inactivos}\n`);

  // ¿Tienen motivoBaja / fechaBaja?
  const conMotivo = await prisma.padron.count({
    where: { organizacionId: org.id, activo: false, motivoBaja: { not: null } },
  });
  const sinMotivo = await prisma.padron.count({
    where: { organizacionId: org.id, activo: false, motivoBaja: null },
  });
  const conFechaBaja = await prisma.padron.count({
    where: { organizacionId: org.id, activo: false, fechaBaja: { not: null } },
  });
  const evaluadosPorCierre = await prisma.padron.count({
    where: { organizacionId: org.id, activo: false, evaluadoCoberturaEn: { not: null } },
  });

  console.log('De los inactivos:');
  console.log(`  Con motivoBaja:   ${conMotivo}`);
  console.log(`  Sin motivoBaja:   ${sinMotivo}`);
  console.log(`  Con fechaBaja:    ${conFechaBaja}`);
  console.log(`  Marcados por cierre mensual (evaluadoCoberturaEn != null): ${evaluadosPorCierre}\n`);

  // Distribución de motivoBaja
  const motivos = await prisma.padron.groupBy({
    by: ['motivoBaja'],
    where: { organizacionId: org.id, activo: false },
    _count: { _all: true },
  });
  console.log('Distribución por motivoBaja:');
  for (const g of motivos.sort((a, b) => (b._count._all ?? 0) - (a._count._all ?? 0))) {
    console.log(`  ${(g.motivoBaja ?? '(NULL)').padEnd(40)} → ${g._count._all}`);
  }

  // Distribución por sistema (los inactivos)
  const sistemas = await prisma.padron.groupBy({
    by: ['sistema'],
    where: { organizacionId: org.id, activo: false },
    _count: { _all: true },
  });
  console.log('\nDistribución por sistema (inactivos):');
  for (const g of sistemas.sort((a, b) => (b._count._all ?? 0) - (a._count._all ?? 0))) {
    console.log(`  ${(g.sistema ?? '(NULL)').padEnd(15)} → ${g._count._all}`);
  }

  // Muestra 10 ejemplos
  const ejemplos = await prisma.padron.findMany({
    where: { organizacionId: org.id, activo: false },
    select: {
      id: true,
      padron: true,
      situacion: true,
      sistema: true,
      motivoBaja: true,
      fechaAlta: true,
      fechaBaja: true,
      evaluadoCoberturaEn: true,
      ultimoPeriodoCobranzaJ17: true,
      afiliado: { select: { dni: true, apellido: true, nombre: true } },
    },
    take: 10,
  });
  console.log('\nPrimeros 10 inactivos:');
  for (const p of ejemplos) {
    console.log(
      `  ${p.padron}  ${p.afiliado.apellido}, ${p.afiliado.nombre}  ` +
        `sit=${p.situacion ?? '-'}  sist=${p.sistema ?? '-'}  ` +
        `motivo=${p.motivoBaja ?? '-'}  ` +
        `fechaBaja=${p.fechaBaja?.toISOString().slice(0, 10) ?? '-'}  ` +
        `ultimoJ17=${p.ultimoPeriodoCobranzaJ17 ?? '-'}  ` +
        `evalCobertura=${p.evaluadoCoberturaEn?.toISOString().slice(0, 10) ?? '-'}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
