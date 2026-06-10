/* eslint-disable no-console */
/**
 * Importador idempotente del listado legacy de comercios (COMERCIO1.csv).
 *
 * Formato esperado:
 *   - Encoding: latin-1 (CP-1252). Lo leemos así para recuperar Ñ/É/etc.
 *   - Separador: ';'
 *   - Header en la primera línea (se ignora).
 *   - Comillas dobles para escapar campos con ';' o '"' (estilo RFC 4180).
 *
 * Upsert por (organizacionId, codigo). Re-ejecutable.
 *
 * Uso:
 *   npx ts-node src/scripts/importar-comercios.ts
 *   npx ts-node src/scripts/importar-comercios.ts --dry-run
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();
const CSV_PATH = resolve(__dirname, 'data', 'comercios.csv');
const ORG_NOMBRE = 'UDAP';
const DRY_RUN = process.argv.includes('--dry-run');

// ──────────────────────────────────────────────────────────────────────────
// CSV parser mínimo con soporte de comillas (RFC 4180-ish, separador ';')
// ──────────────────────────────────────────────────────────────────────────
function parseCsvLine(linea: string, sep = ';'): string[] {
  const out: string[] = [];
  let cur = '';
  let i = 0;
  let inQuotes = false;
  while (i < linea.length) {
    const c = linea[i];
    if (inQuotes) {
      if (c === '"') {
        if (linea[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === sep) {
      out.push(cur);
      cur = '';
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  out.push(cur);
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// Normalizadores
// ──────────────────────────────────────────────────────────────────────────
function nullEmpty(s: string | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t === '' ? null : t;
}

function toBool(s: string | undefined): boolean | null {
  const t = nullEmpty(s);
  if (!t) return null;
  if (t === 'T' || t === 't' || t === '1' || t.toLowerCase() === 'true') return true;
  if (t === 'F' || t === 'f' || t === '0' || t.toLowerCase() === 'false') return false;
  return null;
}

function toInt(s: string | undefined): number | null {
  const t = nullEmpty(s);
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

function toDecimal(s: string | undefined): Prisma.Decimal | null {
  const t = nullEmpty(s);
  if (!t) return null;
  const limpio = t.replace(/\./g, '').replace(',', '.');
  const n = Number(limpio);
  if (!Number.isFinite(n)) return null;
  return new Prisma.Decimal(n);
}

function toFecha(s: string | undefined): Date | null {
  const t = nullEmpty(s);
  if (!t) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toCuit(s: string | undefined): string | null {
  const t = nullEmpty(s);
  if (!t) return null;
  const solo = t.replace(/\D/g, '');
  if (solo.length !== 11) return null;
  return solo;
}

// ──────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  const org = await prisma.organizacion.findFirst({ where: { nombre: ORG_NOMBRE } });
  if (!org) throw new Error(`Organización "${ORG_NOMBRE}" no encontrada`);

  // Lectura en latin-1 para preservar Ñ/É/etc.
  const buf = readFileSync(CSV_PATH);
  const contenido = buf.toString('latin1');
  // Quitar BOM si quedó
  const sinBom = contenido.replace(/^﻿|^ï»¿/, '');
  const lineas = sinBom.split(/\r?\n/);

  if (lineas.length === 0) throw new Error('CSV vacío');

  const header = parseCsvLine(lineas[0]);
  console.log('Header detectado:', header.join(' | '));
  console.log(`Líneas totales (incl. header): ${lineas.length}`);
  console.log(`Modo: ${DRY_RUN ? '🔍 DRY-RUN (no escribe)' : '✏️  ESCRITURA'}`);
  console.log('───────────────────────────────────────');

  let creados = 0;
  let actualizados = 0;
  let saltados = 0;
  const errores: Array<{ linea: number; codigo: string; motivo: string }> = [];

  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i];
    if (linea.trim() === '') {
      saltados++;
      continue;
    }
    const cols = parseCsvLine(linea);
    const codigo = nullEmpty(cols[0]);
    const razonSocial = nullEmpty(cols[1]);
    if (!codigo) {
      errores.push({ linea: i + 1, codigo: '', motivo: 'codigo vacío' });
      continue;
    }
    if (!razonSocial) {
      errores.push({ linea: i + 1, codigo, motivo: 'razonSocial vacía' });
      continue;
    }

    const data = {
      organizacionId: org.id,
      codigo,
      razonSocial,
      domicilio: nullEmpty(cols[2]),
      localidad: nullEmpty(cols[3]),
      fechaIngreso: toFecha(cols[4]),
      telefono1: nullEmpty(cols[5]),
      telefono2: nullEmpty(cols[6]),
      email: nullEmpty(cols[7]),
      grupo: toInt(cols[8]),
      departamento: toInt(cols[9]),
      rubro: toInt(cols[10]),
      tipo: toInt(cols[11]),
      cuoMax: toInt(cols[12]),
      pIVA: toDecimal(cols[13]),
      pGanancia: toDecimal(cols[14]),
      pIngresosBrutos: toDecimal(cols[15]),
      pLoteHogar: toDecimal(cols[16]),
      pRetencion: toDecimal(cols[17]),
      cuit: toCuit(cols[18]),
      iibb: nullEmpty(cols[19]),
      usoContable: toBool(cols[20]),
      baja: toBool(cols[21]),
      confirma: toBool(cols[22]),
      saldoActual: toDecimal(cols[23]),
    };

    if (DRY_RUN) {
      creados++;
      continue;
    }

    try {
      const existe = await prisma.comercio.findFirst({
        where: { organizacionId: org.id, codigo },
        select: { id: true },
      });
      if (existe) {
        await prisma.comercio.update({ where: { id: existe.id }, data });
        actualizados++;
      } else {
        await prisma.comercio.create({ data });
        creados++;
      }
    } catch (e) {
      errores.push({
        linea: i + 1,
        codigo,
        motivo: e instanceof Error ? e.message : String(e),
      });
    }

    if ((creados + actualizados) % 100 === 0 && creados + actualizados > 0) {
      console.log(`  ... ${creados + actualizados} procesados`);
    }
  }

  console.log('───────────────────────────────────────');
  console.log(`✅ Creados:      ${creados}`);
  console.log(`🔁 Actualizados: ${actualizados}`);
  console.log(`⏭️  Saltados:     ${saltados}`);
  console.log(`❌ Errores:      ${errores.length}`);
  if (errores.length) {
    console.log('\nDetalle de errores (primeros 20):');
    for (const e of errores.slice(0, 20)) {
      console.log(`  línea ${e.linea} | cod=${e.codigo} | ${e.motivo}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
