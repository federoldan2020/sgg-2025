/**
 * Parser de la planilla de NOVEDADES que el sistema legacy genera y envía a
 * Cómputos (lo que se descuenta). Es la contracara del TXT de retorno
 * (computos.parser.ts): acá están las obligaciones ENVIADAS; allá lo COBRADO.
 *
 * Formato (xlsx, una fila por padrón):
 *   CENTRO | BLANCO1 | PADRON | COD1 | IMP1 | COD2 | IMP2 | ... | COD5 | IMP5
 *          | SIST | SIST_VACIO | LETRA | FECHA_EG | MOTIVO_EG
 *
 * - Hasta 5 pares (CODn, IMPn) por fila. Códigos: J17 | J22 | J38 | K16.
 * - IMPn viene en CENTAVOS (los 2 últimos dígitos son decimales):
 *     K16 52390590 → $523.905,90 ; J22 4500000 → $45.000,00 ; J17 200 → $2,00
 * - SIST = canal: "ESC" (Cómputos), "SGR", "SOO8"…
 * - FECHA_EG / MOTIVO_EG = egreso del afiliado (Baja/Renuncia/Fallecimiento).
 *
 * Nota sobre J17: en la novedad es un FLAG de alta/baja de la cuota societaria
 * (200 = 2,00 % activa, 0 = baja), NO un importe a cobrar. El 2 % real lo
 * liquida Cómputos y vuelve en el retorno. Por eso J17 no genera obligación de
 * monto fijo (lo marca el importador, no este parser).
 */

import * as ExcelJS from 'exceljs';

export type CodigoNovedad = 'J17' | 'J22' | 'J38' | 'K16';
const CODIGOS_VALIDOS = new Set<CodigoNovedad>(['J17', 'J22', 'J38', 'K16']);

export type NovedadFila = {
  /** Nº de fila en la planilla (1-indexed, incluye header). */
  fila: number;
  centro: string;
  /** Padrón tal cual viene (entero, sin verificador-format). */
  padronRaw: string;
  /** Sólo dígitos, para matchear contra Padron.padron sin depender del formato. */
  padronDigitos: string;
  sist: string;
  /** Importes en PESOS (ya divididos /100) por código presente. */
  conceptos: Partial<Record<CodigoNovedad, number>>;
  fechaEgreso: string | null;
  motivoEgreso: string | null;
};

export type NovedadParseResult = {
  filas: NovedadFila[];
  errores: Array<{ fila: number; motivo: string }>;
  totalFilas: number;
};

/** Normaliza un valor de celda a string de dígitos (descarta no-dígitos, NaN, etc). */
function soloDigitos(v: unknown): string {
  if (v == null) return '';
  const s = String(typeof v === 'object' && v && 'result' in v ? (v as any).result : v);
  const limpio = s.replace(/[^\d]/g, '');
  // quitar ceros a la izquierda para comparar de forma estable
  return limpio.replace(/^0+/, '') || (limpio ? '0' : '');
}

function celdaTexto(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object' && v && 'result' in v) return String((v as any).result ?? '');
  if (typeof v === 'object' && v && 'text' in v) return String((v as any).text ?? '');
  return String(v).trim();
}

/** "52390590" (centavos) → 523905.90. Devuelve null si no es entero válido. */
function centavosAPesos(v: unknown): number | null {
  if (v == null || v === '') return null;
  const raw = String(typeof v === 'object' && v && 'result' in v ? (v as any).result : v).trim();
  if (raw === '' || /nan/i.test(raw)) return null;
  // puede venir como "52390590" o "52390590.0"
  const ent = raw.replace(/\.0+$/, '').replace(/[^\d-]/g, '');
  if (!/^-?\d+$/.test(ent)) return null;
  const n = Number(ent);
  if (!Number.isFinite(n)) return null;
  return n / 100;
}

function fechaEgreso(v: unknown): string | null {
  const t = celdaTexto(v);
  if (!t || /nat|nan/i.test(t)) return null;
  // dejar tal cual (puede venir 2026-03-10, y también basura tipo 7201-07-19
  // que se limpia en una etapa posterior); acá sólo descartamos vacíos.
  return t;
}

/**
 * Parsea el buffer xlsx. Resuelve columnas por nombre de header (case-insensitive)
 * para tolerar reordenamientos.
 */
export async function parseNovedadesXlsx(buf: Buffer): Promise<NovedadParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) {
    return { filas: [], errores: [{ fila: 0, motivo: 'El archivo no tiene hojas.' }], totalFilas: 0 };
  }

  // Mapear header → índice de columna (1-indexed en exceljs).
  const headerRow = ws.getRow(1);
  const col: Record<string, number> = {};
  headerRow.eachCell((cell, idx) => {
    const name = celdaTexto(cell.value).toUpperCase().replace(/\\?_/g, '_').trim();
    if (name) col[name] = idx;
  });

  const cPadron = col['PADRON'];
  const cCentro = col['CENTRO'];
  const cSist = col['SIST'];
  const cFechaEg = col['FECHA_EG'];
  const cMotivoEg = col['MOTIVO_EG'];
  const paresCod: number[] = [];
  const paresImp: number[] = [];
  for (let n = 1; n <= 5; n++) {
    if (col[`COD${n}`] && col[`IMP${n}`]) {
      paresCod.push(col[`COD${n}`]);
      paresImp.push(col[`IMP${n}`]);
    }
  }

  const errores: NovedadParseResult['errores'] = [];
  if (!cPadron) {
    return { filas: [], errores: [{ fila: 1, motivo: 'No se encontró la columna PADRON.' }], totalFilas: 0 };
  }

  const filas: NovedadFila[] = [];
  let totalFilas = 0;

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    totalFilas++;

    const padronDigitos = soloDigitos(row.getCell(cPadron).value);
    if (!padronDigitos || padronDigitos === '0') {
      errores.push({ fila: rowNumber, motivo: `Padrón vacío o 0` });
      return;
    }

    const conceptos: Partial<Record<CodigoNovedad, number>> = {};
    for (let i = 0; i < paresCod.length; i++) {
      const cod = celdaTexto(row.getCell(paresCod[i]).value).toUpperCase();
      if (!cod || /nan/i.test(cod)) continue;
      if (!CODIGOS_VALIDOS.has(cod as CodigoNovedad)) {
        errores.push({ fila: rowNumber, motivo: `Código desconocido: "${cod}"` });
        continue;
      }
      const pesos = centavosAPesos(row.getCell(paresImp[i]).value);
      if (pesos == null) continue;
      conceptos[cod as CodigoNovedad] = (conceptos[cod as CodigoNovedad] ?? 0) + pesos;
    }

    filas.push({
      fila: rowNumber,
      centro: cCentro ? celdaTexto(row.getCell(cCentro).value) : '',
      padronRaw: celdaTexto(row.getCell(cPadron).value).replace(/\.0+$/, ''),
      padronDigitos,
      sist: cSist ? celdaTexto(row.getCell(cSist).value) : '',
      conceptos,
      fechaEgreso: cFechaEg ? fechaEgreso(row.getCell(cFechaEg).value) : null,
      motivoEgreso: cMotivoEg ? (celdaTexto(row.getCell(cMotivoEg).value) || null) : null,
    });
  });

  return { filas, errores, totalFilas };
}
