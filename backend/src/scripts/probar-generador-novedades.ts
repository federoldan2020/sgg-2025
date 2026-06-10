/* eslint-disable no-console */
/**
 * Test del nuevo generador operator-driven.
 *
 *   1. Lista NovedadPendiente activas del período objetivo.
 *   2. Si ya existe lote para ese período → lo muestra (lo va a regenerar).
 *   3. Llama a generarBorrador.
 *   4. Muestra resumen + busca la línea del padrón con pendientes.
 *
 * Uso:
 *   npx ts-node -r tsconfig-paths/register src/scripts/probar-generador-novedades.ts [periodo]
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma.service';
import { NovedadesService } from '../modulos/novedades/novedades.service';

async function main() {
  const periodo = process.argv[2] || '2026-06';
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const novedades = app.get(NovedadesService);

  const org = await prisma.organizacion.findFirst({ where: { nombre: 'UDAP' } });
  if (!org) throw new Error('UDAP no encontrada');

  console.log(`\n═══ TEST GENERADOR OPERATOR-DRIVEN ═══`);
  console.log(`Org: ${org.nombre} | Período: ${periodo}\n`);

  // 1) Pendientes activas
  const pendientes = await prisma.novedadPendiente.findMany({
    where: {
      organizacionId: org.id,
      estado: 'pendiente',
      periodoObjetivo: periodo,
      destino: 'COMPUTOS',
    },
    include: {
      padron: { select: { padron: true, centro: true } },
      afiliado: { select: { apellido: true, nombre: true, dni: true } },
    },
  });
  console.log(`📋 Pendientes activas (destino=COMPUTOS, periodo=${periodo}): ${pendientes.length}`);
  for (const p of pendientes) {
    console.log(
      `   ${p.concepto} ${p.tipoMovimiento.padEnd(13)} padron=${p.padron.padron} ` +
        `${p.afiliado.apellido}, ${p.afiliado.nombre} ` +
        `(valor=${p.valor ? Number(p.valor) : '—'}) origen=${p.origenEvento}`,
    );
  }

  // 2) Lote existente
  const loteExistente = await prisma.novedadLote.findFirst({
    where: { organizacionId: org.id, periodo, canal: 'ESC' },
    orderBy: { generadoEn: 'desc' },
    select: { id: true, estado: true },
  });
  if (loteExistente) {
    console.log(
      `\n📦 Lote existente id=${loteExistente.id.toString()} estado=${loteExistente.estado}`,
    );
    if (loteExistente.estado !== 'borrador' && loteExistente.estado !== 'anulado') {
      console.log(`   ⚠️ No es regenerable (${loteExistente.estado}). Abortando.`);
      await app.close();
      return;
    }
  } else {
    console.log('\n📦 No hay lote previo, se va a crear uno nuevo.');
  }

  // 3) Generar/regenerar
  console.log('\n🛠️  Generando borrador...');
  const lote = await novedades.generarBorrador({
    organizacionId: org.id,
    periodo,
    canal: 'ESC',
  });
  console.log(`   ✅ Lote id=${lote.id} estado=${lote.estado}`);
  console.log(`   Totales: ${lote.totalLineas} líneas | ${lote.totalAfiliados} afiliados`);
  console.log(
    `   J22=$${Number(lote.totalJ22)} J38=$${Number(lote.totalJ38)} K16=$${Number(
      lote.totalK16,
    )} J17Altas=${lote.totalJ17Altas} J17Bajas=${lote.totalJ17Bajas}`,
  );

  // 4) Buscar líneas de padrones con pendientes
  if (pendientes.length > 0) {
    console.log('\n🔍 Líneas del TXT para los padrones con pendientes:');
    const padronIds = pendientes.map((p) => p.padronId);
    const items = await prisma.novedadLoteItem.findMany({
      where: { loteId: BigInt(lote.id), padronId: { in: padronIds } },
      select: {
        padronSnapshot: true,
        lineaCompleta: true,
        valorJ17: true,
        valorJ22: true,
        valorJ38: true,
        valorK16: true,
        tipoMovimiento: true,
      },
    });
    for (const it of items) {
      console.log(`   ${it.padronSnapshot} [${it.tipoMovimiento}]`);
      console.log(`     |${it.lineaCompleta}|`);
      console.log(
        `     J17=${it.valorJ17 ?? '—'} J22=${it.valorJ22 ?? '—'} J38=${
          it.valorJ38 ?? '—'
        } K16=${it.valorK16 ?? '—'}`,
      );
    }
  }

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
