/* eslint-disable no-console */
/**
 * Reactiva padrones que fueron marcados inactivos por un cierre mensual
 * usando la regla vieja (bug). Criterio seguro:
 *   - activo = false
 *   - motivoBaja = null  (no es baja manual real)
 *   - fechaBaja = null
 *   - evaluadoCoberturaEn != null (los marcó el cierre)
 *   - ultimoPeriodoCobranzaJ17 >= (hoy - 3 meses)
 *     → o sea, sí cobraron recientemente, no deberían estar inactivos.
 *
 * Además: cancela cualquier `BajaInformable(PADRON_COMPLETO, cierre_inactivo_3m)`
 * pendiente para los padrones reactivados, para que no se envíen a Cómputos
 * por error en el próximo lote.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function periodoActual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function restarMeses(periodo: string, n: number): string {
  const [y, m] = periodo.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  const org = await prisma.organizacion.findFirst({ where: { nombre: 'UDAP' } });
  if (!org) throw new Error('Org UDAP no encontrada');

  const hoy = periodoActual();
  const limite = restarMeses(hoy, 3);
  console.log(`Hoy: ${hoy} | Límite "3 meses": ${limite}`);
  console.log(`Reactivar si ultimoPeriodoCobranzaJ17 >= ${limite}\n`);

  const candidatos = await prisma.padron.findMany({
    where: {
      organizacionId: org.id,
      activo: false,
      motivoBaja: null,
      fechaBaja: null,
      evaluadoCoberturaEn: { not: null },
      ultimoPeriodoCobranzaJ17: { gte: limite },
    },
    select: { id: true, padron: true, ultimoPeriodoCobranzaJ17: true },
  });

  console.log(`Candidatos a reactivar: ${candidatos.length}`);
  if (candidatos.length === 0) {
    console.log('Nada para hacer.');
    return;
  }

  // Mostrar muestra
  for (const c of candidatos.slice(0, 5)) {
    console.log(`  ${c.padron}  últimoJ17=${c.ultimoPeriodoCobranzaJ17}`);
  }
  if (candidatos.length > 5) console.log(`  … y ${candidatos.length - 5} más`);

  const ids = candidatos.map((c) => c.id);

  const r = await prisma.$transaction([
    prisma.padron.updateMany({
      where: { id: { in: ids } },
      data: {
        activo: true,
        evaluadoCoberturaEn: null,
      },
    }),
    prisma.bajaInformable.updateMany({
      where: {
        organizacionId: org.id,
        padronId: { in: ids },
        codigo: 'PADRON_COMPLETO',
        motivo: 'cierre_inactivo_3m',
        estado: 'pendiente',
      },
      data: {
        estado: 'cancelada',
        fechaCancelada: new Date(),
        motivoCancelacion: 'Reactivación automática: el padrón sí tenía cobranza reciente (bug del cierre viejo).',
      },
    }),
  ]);

  console.log(`\n✅ Padrones reactivados: ${r[0].count}`);
  console.log(`✅ Bajas informables canceladas: ${r[1].count}`);

  // Estado final
  const activos = await prisma.padron.count({
    where: { organizacionId: org.id, activo: true },
  });
  const inactivos = await prisma.padron.count({
    where: { organizacionId: org.id, activo: false },
  });
  console.log(`\nEstado final: ${activos} activos · ${inactivos} inactivos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
