/* eslint-disable no-console */
/**
 * Siembra las reglas iniciales del módulo de coseguro tras la nueva migración:
 *
 *   1. ReglaPrecioCoseguro       → J22 = $45.000.
 *   2. ReglaPrecioColateral      → comodín $10.000 por cada colateral.
 *   3. ReglaCoberturaCoseguro    → 4 órdenes de farmacia por mes.
 *   4. Parentescos               → asegura códigos canónicos.
 *   5. ReglaClasificacionIntegrante → mapeo derivado de GF / J38 / SIN_COBERTURA.
 *   6. Farmacia interna          → 1 fila para la farmacia del gremio.
 *
 * Idempotente: si ya existe una regla activa equivalente vigente al día de hoy,
 * se omite. Reglas anteriores quedan tal cual (no se desactivan).
 *
 * Uso:
 *   npx ts-node src/scripts/sembrar-reglas-coseguro.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';

type Parent = 'CONYUGE' | 'HIJO' | 'PADRE' | 'MADRE' | 'SUEGRO' | 'SUEGRA' | 'HERMANO' | 'NIETO';

const PARENTESCOS_CANON: { codigo: number; descripcion: string; key: Parent }[] = [
  { codigo: 1, descripcion: 'CONYUGE', key: 'CONYUGE' },
  { codigo: 2, descripcion: 'HIJO/A', key: 'HIJO' },
  { codigo: 3, descripcion: 'PADRE', key: 'PADRE' },
  { codigo: 4, descripcion: 'MADRE', key: 'MADRE' },
  { codigo: 5, descripcion: 'SUEGRO', key: 'SUEGRO' },
  { codigo: 6, descripcion: 'SUEGRA', key: 'SUEGRA' },
  { codigo: 7, descripcion: 'HERMANO/A', key: 'HERMANO' },
  { codigo: 8, descripcion: 'NIETO/A', key: 'NIETO' },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);

  const org = await prisma.organizacion.findFirst({ where: { nombre: 'UDAP' } });
  if (!org) throw new Error('Organización UDAP no encontrada');
  const orgId = org.id;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  console.log('═══ SIEMBRA REGLAS COSEGURO ═══');
  console.log(`Org: ${org.nombre} (${orgId})`);
  console.log(`Vigencia: ${hoy.toISOString().slice(0, 10)}\n`);

  // ──────────────────────────────────────────────────
  // 1) Parentescos canónicos (alta si faltan)
  // ──────────────────────────────────────────────────
  console.log('── Parentescos ───────────────────────');
  const parentMap = new Map<Parent, bigint>();
  for (const p of PARENTESCOS_CANON) {
    const existente = await prisma.parentesco.findFirst({
      where: { organizacionId: orgId, codigo: p.codigo },
      select: { id: true, descripcion: true },
    });
    if (existente) {
      parentMap.set(p.key, existente.id);
      console.log(`  · ${p.codigo} ${existente.descripcion} (ya existía)`);
    } else {
      const creado = await prisma.parentesco.create({
        data: {
          organizacionId: orgId,
          codigo: p.codigo,
          descripcion: p.descripcion,
          activo: true,
        },
        select: { id: true },
      });
      parentMap.set(p.key, creado.id);
      console.log(`  ✅ ${p.codigo} ${p.descripcion} (creado)`);
    }
  }

  // ──────────────────────────────────────────────────
  // 2) ReglaPrecioCoseguro J22 = $45.000
  // ──────────────────────────────────────────────────
  console.log('\n── Precio J22 ────────────────────────');
  const precioJ22 = new Prisma.Decimal(45000);
  const j22Vigente = await prisma.reglaPrecioCoseguro.findFirst({
    where: {
      organizacionId: orgId,
      activo: true,
      vigenteDesde: { lte: hoy },
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: hoy } }],
    },
    orderBy: { vigenteDesde: 'desc' },
  });
  if (j22Vigente && new Prisma.Decimal(j22Vigente.precioBase).equals(precioJ22)) {
    console.log(`  · ya existe regla activa con precioBase=${precioJ22.toString()} (skip)`);
  } else {
    const creado = await prisma.reglaPrecioCoseguro.create({
      data: {
        organizacionId: orgId,
        vigenteDesde: hoy,
        vigenteHasta: null,
        precioBase: precioJ22,
        activo: true,
      },
      select: { id: true },
    });
    console.log(`  ✅ ReglaPrecioCoseguro id=${creado.id.toString()} precioBase=${precioJ22.toString()}`);
  }

  // ──────────────────────────────────────────────────
  // 3) ReglaPrecioColateral comodín: $10.000 por colateral
  // ──────────────────────────────────────────────────
  console.log('\n── Precio J38 (comodín) ──────────────');
  const precioJ38 = new Prisma.Decimal(10000);
  const j38Existente = await prisma.reglaPrecioColateral.findFirst({
    where: {
      organizacionId: orgId,
      parentescoId: null,
      cantidadDesde: 1,
      cantidadHasta: null,
      activo: true,
      vigenteHasta: null,
    },
    orderBy: { vigenteDesde: 'desc' },
  });
  if (
    j38Existente &&
    j38Existente.precioPorColateral != null &&
    new Prisma.Decimal(j38Existente.precioPorColateral).equals(precioJ38)
  ) {
    console.log(`  · ya existe regla comodín con precioPorColateral=${precioJ38.toString()} (skip)`);
  } else {
    const creado = await prisma.reglaPrecioColateral.create({
      data: {
        organizacionId: orgId,
        parentescoId: null,
        cantidadDesde: 1,
        cantidadHasta: null,
        vigenteDesde: hoy,
        vigenteHasta: null,
        precioPorColateral: precioJ38,
        precioTotal: null,
        activo: true,
      },
      select: { id: true },
    });
    console.log(
      `  ✅ ReglaPrecioColateral comodín id=${creado.id.toString()} precioPorColateral=${precioJ38.toString()}`,
    );
  }

  // ──────────────────────────────────────────────────
  // 4) ReglaCoberturaCoseguro: 4 órdenes/mes
  // ──────────────────────────────────────────────────
  console.log('\n── Cobertura: órdenes por mes ────────');
  const ordenesPorMes = 4;
  const cobVigente = await prisma.reglaCoberturaCoseguro.findFirst({
    where: {
      organizacionId: orgId,
      activo: true,
      vigenteDesde: { lte: hoy },
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: hoy } }],
    },
    orderBy: { vigenteDesde: 'desc' },
  });
  if (cobVigente && cobVigente.ordenesPorMes === ordenesPorMes) {
    console.log(`  · ya existe regla activa con ordenesPorMes=${ordenesPorMes} (skip)`);
  } else {
    const creado = await prisma.reglaCoberturaCoseguro.create({
      data: {
        organizacionId: orgId,
        ordenesPorMes,
        vigenteDesde: hoy,
        vigenteHasta: null,
        activo: true,
      },
      select: { id: true },
    });
    console.log(
      `  ✅ ReglaCoberturaCoseguro id=${creado.id.toString()} ordenesPorMes=${ordenesPorMes}`,
    );
  }

  // ──────────────────────────────────────────────────
  // 5) Reglas de clasificación (data-driven)
  // ──────────────────────────────────────────────────
  console.log('\n── Reglas de clasificación ───────────');
  const reglasClasif: Array<{
    prioridad: number;
    parentesco: Parent | null;
    edadDesde: number | null;
    edadHasta: number | null;
    requiereEstudiante: boolean | null;
    requiereAportes: boolean | null;
    requiereDiscapacidad: boolean | null;
    resultado: 'GF' | 'J38' | 'SIN_COBERTURA';
    descripcion: string;
  }> = [
    // Cónyuge: espejo por aportes (sin importar sexo del titular)
    {
      prioridad: 10,
      parentesco: 'CONYUGE',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: false,
      requiereDiscapacidad: null,
      resultado: 'GF',
      descripcion: 'Cónyuge sin aportes → grupo familiar',
    },
    {
      prioridad: 11,
      parentesco: 'CONYUGE',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: true,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Cónyuge con aportes → colateral J38',
    },
    // Hijos
    {
      prioridad: 20,
      parentesco: 'HIJO',
      edadDesde: null,
      edadHasta: 20,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'GF',
      descripcion: 'Hijo ≤ 20 años → grupo familiar',
    },
    {
      prioridad: 21,
      parentesco: 'HIJO',
      edadDesde: 21,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: true,
      resultado: 'J38',
      descripcion: 'Hijo discapacitado ≥ 21 → colateral J38',
    },
    {
      prioridad: 22,
      parentesco: 'HIJO',
      edadDesde: 21,
      edadHasta: 26,
      requiereEstudiante: true,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Hijo estudiante 21-26 → colateral J38',
    },
    {
      prioridad: 23,
      parentesco: 'HIJO',
      edadDesde: 21,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'SIN_COBERTURA',
      descripcion: 'Hijo ≥ 21 sin condiciones → sin cobertura (fallback)',
    },
    // Padre, madre, suegro/a, hermano/a, nieto/a → J38 sin restricción
    ...(['PADRE', 'MADRE', 'SUEGRO', 'SUEGRA', 'HERMANO', 'NIETO'] as Parent[]).map(
      (p, idx) => ({
        prioridad: 30 + idx,
        parentesco: p,
        edadDesde: null,
        edadHasta: null,
        requiereEstudiante: null,
        requiereAportes: null,
        requiereDiscapacidad: null,
        resultado: 'J38' as const,
        descripcion: `${p} → colateral J38`,
      }),
    ),
  ];

  for (const r of reglasClasif) {
    const parentescoId = r.parentesco ? parentMap.get(r.parentesco) ?? null : null;
    const existente = await prisma.reglaClasificacionIntegrante.findFirst({
      where: {
        organizacionId: orgId,
        prioridad: r.prioridad,
        activo: true,
        vigenteHasta: null,
      },
    });
    if (existente) {
      console.log(`  · prioridad=${r.prioridad} ya existe (skip)`);
      continue;
    }
    const creado = await prisma.reglaClasificacionIntegrante.create({
      data: {
        organizacionId: orgId,
        parentescoId,
        sexoTitular: null,
        edadDesde: r.edadDesde,
        edadHasta: r.edadHasta,
        requiereEstudiante: r.requiereEstudiante,
        requiereAportes: r.requiereAportes,
        requiereDiscapacidad: r.requiereDiscapacidad,
        resultado: r.resultado,
        prioridad: r.prioridad,
        vigenteDesde: hoy,
        vigenteHasta: null,
        activo: true,
        descripcion: r.descripcion,
      },
      select: { id: true },
    });
    console.log(
      `  ✅ prioridad=${r.prioridad} → ${r.resultado.padEnd(13)} | ${r.descripcion}`,
    );
    void creado;
  }

  // ──────────────────────────────────────────────────
  // 6) Farmacia interna del gremio
  // ──────────────────────────────────────────────────
  console.log('\n── Farmacia interna ──────────────────');
  const interna = await prisma.farmacia.findFirst({
    where: { organizacionId: orgId, esInterna: true },
  });
  if (interna) {
    console.log(`  · ya existe farmacia interna codigo=${interna.codigo} (skip)`);
  } else {
    const creada = await prisma.farmacia.create({
      data: {
        organizacionId: orgId,
        codigo: 'GREMIO',
        nombre: 'Farmacia del Gremio',
        esInterna: true,
        activo: true,
      },
      select: { id: true, codigo: true },
    });
    console.log(`  ✅ Farmacia interna id=${creada.id.toString()} codigo=${creada.codigo}`);
  }

  console.log('\n═══ FIN SIEMBRA ═══');
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
