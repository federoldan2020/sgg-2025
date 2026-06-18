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

/**
 * Catálogo canónico de parentescos de UDAP (alineado con producción al
 * 2026-06-18). Los códigos NO son secuenciales: el código 5 fue eliminado
 * tras una corrida errónea del script viejo. La regla "no usar código 5"
 * queda permanente para no confundir con históricos.
 *
 * El catálogo encodea condiciones (discapacidad por edad, cónyuge con
 * aportes) en el parentesco mismo — por eso varios parentescos para
 * "hijo discapacitado" según rango etario. Las reglas de clasificación
 * de abajo aprovechan esto en lugar de depender de flags genéricos.
 */
type Parent =
  | 'CONYUGE' // 1
  | 'HIJO' // 2
  | 'PADRE_MADRE' // 3
  | 'HERMANO' // 4
  | 'HIJO_DISC' // 6
  | 'SUEGRO' // 7
  | 'HIJO_DISC_MAYOR26' // 8
  | 'NIETO' // 9
  | 'HIJO_DISC_21_26' // 10
  | 'CONYUGE_CON_APORTES' // 11
  | 'HIJO_DISC_GENERICO' // 12
  | 'HABILITADOS_OTROS'; // 13 — legacy, sin regla

const PARENTESCOS_CANON: { codigo: number; descripcion: string; key: Parent }[] = [
  { codigo: 1, descripcion: 'CONYUGE', key: 'CONYUGE' },
  { codigo: 2, descripcion: 'HIJO/A', key: 'HIJO' },
  { codigo: 3, descripcion: 'PADRE/MADRE', key: 'PADRE_MADRE' },
  { codigo: 4, descripcion: 'HERMANO/A', key: 'HERMANO' },
  // codigo 5 reservado: no usar (parentesco SUEGRO obsoleto eliminado)
  { codigo: 6, descripcion: 'HIJO DISCAPACITADO', key: 'HIJO_DISC' },
  { codigo: 7, descripcion: 'SUEGRO/A', key: 'SUEGRO' },
  { codigo: 8, descripcion: 'HIJO/A DISC(MAYOR 26 AÑOS)', key: 'HIJO_DISC_MAYOR26' },
  { codigo: 9, descripcion: 'NIETO/A MENOR TENENCIA', key: 'NIETO' },
  { codigo: 10, descripcion: 'HIJO DISC(21 a 26 años)', key: 'HIJO_DISC_21_26' },
  { codigo: 11, descripcion: 'CONY.C/AP Y/O ADM.PUBL', key: 'CONYUGE_CON_APORTES' },
  { codigo: 12, descripcion: 'HIJO/A DISC', key: 'HIJO_DISC_GENERICO' },
  { codigo: 13, descripcion: 'HABILITADOS/OTROS', key: 'HABILITADOS_OTROS' },
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
  //
  // Modelo: el catálogo de parentescos ya distingue casos especiales
  // (cónyuge con aportes = código 11; cuatro categorías de hijo
  // discapacitado según edad). Por eso las reglas mapean 1-a-1 contra
  // parentescos en vez de depender de flags genéricos.
  //
  // HABILITADOS/OTROS (cód 13) queda en el catálogo pero sin regla —
  // legacy, no se usa en altas nuevas.
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
    // Cónyuge
    {
      prioridad: 10,
      parentesco: 'CONYUGE',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: false,
      requiereDiscapacidad: null,
      resultado: 'GF',
      descripcion: 'Conyuge (cod 1) sin aportes -> grupo familiar',
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
      descripcion: 'Conyuge (cod 1) con aportes -> colateral J38 (legacy si quedaron asi)',
    },
    {
      prioridad: 12,
      parentesco: 'CONYUGE_CON_APORTES',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Conyuge con aportes / admin publica (cod 11) -> colateral J38',
    },
    // Hijos base
    {
      prioridad: 20,
      parentesco: 'HIJO',
      edadDesde: null,
      edadHasta: 20,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'GF',
      descripcion: 'Hijo/a (cod 2) <= 20 anos -> grupo familiar',
    },
    {
      prioridad: 21,
      parentesco: 'HIJO',
      edadDesde: 21,
      edadHasta: 26,
      requiereEstudiante: true,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Hijo/a (cod 2) 21-26 estudiante -> colateral J38',
    },
    {
      prioridad: 22,
      parentesco: 'HIJO',
      edadDesde: 21,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'SIN_COBERTURA',
      descripcion: 'Hijo/a (cod 2) >= 21 sin condicion -> sin cobertura (fallback)',
    },
    // Hijos con parentesco de discapacidad propio
    {
      prioridad: 23,
      parentesco: 'HIJO_DISC',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Hijo discapacitado (cod 6) -> colateral J38',
    },
    {
      prioridad: 24,
      parentesco: 'HIJO_DISC_MAYOR26',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Hijo/a disc. mayor 26 (cod 8) -> colateral J38',
    },
    {
      prioridad: 25,
      parentesco: 'HIJO_DISC_21_26',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Hijo disc. 21-26 (cod 10) -> colateral J38',
    },
    {
      prioridad: 26,
      parentesco: 'HIJO_DISC_GENERICO',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Hijo/a discapacitado generico (cod 12) -> colateral J38',
    },
    // Resto del grupo familiar -> J38
    {
      prioridad: 30,
      parentesco: 'PADRE_MADRE',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Padre/madre (cod 3) -> colateral J38',
    },
    {
      prioridad: 31,
      parentesco: 'HERMANO',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Hermano/a (cod 4) -> colateral J38',
    },
    {
      prioridad: 32,
      parentesco: 'SUEGRO',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Suegro/a (cod 7) -> colateral J38',
    },
    {
      prioridad: 33,
      parentesco: 'NIETO',
      edadDesde: null,
      edadHasta: null,
      requiereEstudiante: null,
      requiereAportes: null,
      requiereDiscapacidad: null,
      resultado: 'J38',
      descripcion: 'Nieto/a menor a cargo (cod 9) -> colateral J38',
    },
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
