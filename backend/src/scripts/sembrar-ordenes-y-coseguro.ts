/* eslint-disable no-console */
/**
 * Siembra datos de prueba para validar el generador de novedades:
 *
 *  - 6 órdenes de crédito a padrones distintos (mezcla de cuotas/periodos),
 *    cada cuota materializa una Obligacion K16 cobrable.
 *  - 3 altas de coseguro en afiliados sin coseguro activo.
 *  - 2 bajas de coseguro en afiliados con coseguro activo.
 *
 * Idempotente: si ya hay órdenes creadas por una corrida previa, omite
 * volver a generarlas (filtra padrones sin órdenes activas).
 *
 * Uso:
 *   npx ts-node src/scripts/sembrar-ordenes-y-coseguro.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma.service';
import { OrdenesService } from '../modulos/ordenes/ordenes.service';
import { CoseguroService } from '../modulos/coseguro/coseguro.service';

type PadronLite = {
  id: bigint;
  padron: string;
  afiliadoId: bigint;
  apellido: string | null;
  nombre: string | null;
};

type ComercioLite = {
  id: bigint;
  codigo: string;
  razonSocial: string;
  cuoMax: number | null;
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const ordenes = app.get(OrdenesService);
  const coseguro = app.get(CoseguroService);

  const org = await prisma.organizacion.findFirst({ where: { nombre: 'UDAP' } });
  if (!org) throw new Error('UDAP no encontrada');

  console.log('═══ SIEMBRA DE DATOS DE PRUEBA ═══');
  console.log(`Org: ${org.nombre} (${org.id})\n`);

  // ──────────────────────────────────────────────────
  // 1) Comercios candidatos (activos, cuoMax >= 6)
  // ──────────────────────────────────────────────────
  const comercios: ComercioLite[] = (await prisma.comercio.findMany({
    where: {
      organizacionId: org.id,
      OR: [{ baja: false }, { baja: null }],
      cuoMax: { gte: 6 },
    },
    select: { id: true, codigo: true, razonSocial: true, cuoMax: true },
    orderBy: { codigo: 'asc' },
    take: 3,
  })) as unknown as ComercioLite[];

  if (comercios.length < 3) {
    throw new Error(
      `Se necesitan 3 comercios con cuoMax >= 6. Encontrados: ${comercios.length}`,
    );
  }
  console.log('Comercios elegidos:');
  for (const c of comercios) {
    console.log(`  - ${c.codigo} | ${c.razonSocial} (cuoMax=${c.cuoMax})`);
  }

  // ──────────────────────────────────────────────────
  // 2) Padrones candidatos: activos, sistema=ESC, sin órdenes vigentes
  // ──────────────────────────────────────────────────
  const ordenesActivas = await prisma.ordenCredito.findMany({
    where: { organizacionId: org.id, estado: { in: ['pendiente', 'en_curso'] } },
    select: { padronId: true },
  });
  const padronesConOrden = Array.from(
    new Set(ordenesActivas.map((o) => o.padronId).filter((x): x is bigint => x != null)),
  );

  const padronesRaw = await prisma.padron.findMany({
    where: {
      organizacionId: org.id,
      activo: true,
      sistema: 'ESC',
      id: padronesConOrden.length ? { notIn: padronesConOrden } : undefined,
      afiliado: { estado: 'activo' },
    },
    select: {
      id: true,
      padron: true,
      afiliadoId: true,
      afiliado: { select: { apellido: true, nombre: true } },
    },
    take: 6,
    orderBy: { id: 'asc' },
  });
  const padrones: PadronLite[] = padronesRaw.map((p) => ({
    id: p.id,
    padron: p.padron,
    afiliadoId: p.afiliadoId,
    apellido: p.afiliado?.apellido ?? null,
    nombre: p.afiliado?.nombre ?? null,
  }));

  if (padrones.length < 6) {
    throw new Error(`Se necesitan 6 padrones ESC sin órdenes. Encontrados: ${padrones.length}`);
  }
  console.log('\nPadrones elegidos para órdenes:');
  for (const p of padrones) {
    console.log(`  - padron=${p.padron} (${p.apellido ?? ''} ${p.nombre ?? ''})`);
  }

  // ──────────────────────────────────────────────────
  // 3) Crear órdenes variadas
  // ──────────────────────────────────────────────────
  const especificaciones = [
    { padron: padrones[0], comercio: comercios[0], monto: 60000, cuotas: 3, periodoPrimera: '2026-06' },
    { padron: padrones[1], comercio: comercios[1], monto: 120000, cuotas: 6, periodoPrimera: '2026-07' },
    { padron: padrones[2], comercio: comercios[2], monto: 300000, cuotas: 12, periodoPrimera: '2026-07' },
    { padron: padrones[3], comercio: comercios[0], monto: 45000, cuotas: 6, periodoPrimera: '2026-05' }, // arrastres
    { padron: padrones[4], comercio: comercios[1], monto: 80000, cuotas: 4, periodoPrimera: '2026-07' },
    { padron: padrones[5], comercio: comercios[2], monto: 24000, cuotas: 6, periodoPrimera: '2026-08' }, // futura
  ];

  console.log('\n── Creando órdenes ───────────────────');
  for (const e of especificaciones) {
    try {
      const dto: any = {
        afiliadoId: e.padron.afiliadoId.toString(),
        padronId: e.padron.id.toString(),
        comercioId: e.comercio.id.toString(),
        monto: e.monto,
        cuotas: e.cuotas,
        periodoPrimera: e.periodoPrimera,
        descripcion: `Prueba: ${e.cuotas}x${e.monto} en ${e.comercio.razonSocial}`,
      };
      const o = await ordenes.crearOrden(org.id, dto);
      console.log(
        `  ✅ ORD#${o.id.toString()} | padron=${e.padron.padron} | ${e.cuotas}x ${e.monto} | desde ${e.periodoPrimera}`,
      );
    } catch (err: any) {
      console.log(
        `  ❌ padron=${e.padron.padron}: ${err?.message ?? String(err)}`,
      );
    }
  }

  // ──────────────────────────────────────────────────
  // 4) Coseguro: altas (afiliados sin coseguro)
  // ──────────────────────────────────────────────────
  console.log('\n── Altas de coseguro ─────────────────');
  const candidatosAlta = await prisma.padron.findMany({
    where: {
      organizacionId: org.id,
      activo: true,
      sistema: 'ESC',
      afiliado: {
        estado: 'activo',
        OR: [
          { coseguro: { is: null } },
          { coseguro: { estado: { not: 'activo' } } },
        ],
      },
      // distintos de los padrones con orden, para que no se cruce
      id: { notIn: padrones.map((p) => p.id) },
    },
    select: {
      id: true,
      padron: true,
      afiliadoId: true,
      afiliado: { select: { apellido: true, nombre: true } },
    },
    take: 3,
    orderBy: { id: 'asc' },
  });

  for (const c of candidatosAlta) {
    try {
      await coseguro.altaCoseguro(org.id, c.afiliadoId, c.id);
      console.log(
        `  ✅ ALTA J22 | padron=${c.padron} (${c.afiliado?.apellido ?? ''} ${c.afiliado?.nombre ?? ''})`,
      );
    } catch (err: any) {
      console.log(`  ❌ padron=${c.padron}: ${err?.message ?? String(err)}`);
    }
  }
  if (candidatosAlta.length < 3) {
    console.log(
      `  ⚠️  Solo ${candidatosAlta.length} afiliados sin coseguro disponibles (se esperaban 3).`,
    );
  }

  // ──────────────────────────────────────────────────
  // 5) Coseguro: bajas (afiliados con coseguro activo)
  // ──────────────────────────────────────────────────
  console.log('\n── Bajas de coseguro ─────────────────');
  const candidatosBaja = await prisma.padron.findMany({
    where: {
      organizacionId: org.id,
      activo: true,
      sistema: 'ESC',
      afiliado: {
        estado: 'activo',
        coseguro: { estado: 'activo' },
      },
      // distinto del set anterior
      id: { notIn: [...padrones.map((p) => p.id), ...candidatosAlta.map((c) => c.id)] },
    },
    select: {
      id: true,
      padron: true,
      afiliadoId: true,
      afiliado: { select: { apellido: true, nombre: true } },
    },
    take: 2,
    orderBy: { id: 'asc' },
  });

  for (const c of candidatosBaja) {
    try {
      await coseguro.bajaCoseguro(org.id, c.afiliadoId);
      console.log(
        `  ✅ BAJA J22 | padron=${c.padron} (${c.afiliado?.apellido ?? ''} ${c.afiliado?.nombre ?? ''})`,
      );
    } catch (err: any) {
      console.log(`  ❌ padron=${c.padron}: ${err?.message ?? String(err)}`);
    }
  }
  if (candidatosBaja.length < 2) {
    console.log(
      `  ⚠️  Solo ${candidatosBaja.length} afiliados con coseguro activo disponibles (se esperaban 2).`,
    );
  }

  // ──────────────────────────────────────────────────
  // 6) Resumen final
  // ──────────────────────────────────────────────────
  const totOrdenes = await prisma.ordenCredito.count({
    where: { organizacionId: org.id, estado: { in: ['pendiente', 'en_curso'] } },
  });
  const conceptoK16 = await prisma.concepto.findFirst({
    where: { organizacionId: org.id, codigo: 'ORDEN_CREDITO' },
    select: { id: true },
  });
  const totObligK16 = conceptoK16
    ? await prisma.obligacion.count({
        where: {
          organizacionId: org.id,
          conceptoId: conceptoK16.id,
          estado: { in: ['pendiente', 'parcialmente_pagada'] },
          saldo: { gt: 0 },
        },
      })
    : 0;
  const totCosActivos = await prisma.coseguroAfiliado.count({
    where: { organizacionId: org.id, estado: 'activo' },
  });

  console.log('\n═══ RESUMEN POST-SIEMBRA ═══');
  console.log(`Órdenes activas:           ${totOrdenes}`);
  console.log(`Obligaciones K16 abiertas: ${totObligK16}`);
  console.log(`Coseguros activos:         ${totCosActivos}`);

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
