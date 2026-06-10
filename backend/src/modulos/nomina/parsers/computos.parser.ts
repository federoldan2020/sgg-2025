/**
 * Parser del TXT de retorno de Cómputos (Provincia de San Juan).
 *
 * Línea de longitud variable:
 *   Header fijo (45 chars) + N bloques de 12 chars cada uno.
 *
 * Header (1-indexed):
 *   1-3   situación (SUP, TI, …)
 *   4-5   centro (2 dígitos)
 *   6-12  padrón crudo (7 dígitos, último = verificador)
 *   13-33 apellido + nombre (21 chars, padding con espacios)
 *   34    tipo de documento (1 dígito; informativo)
 *   35-42 DNI (8 dígitos)
 *   43-46 período AAMM  →  Abril 2026 = "2604" (año 26, mes 04)
 *
 * Bloque (12 chars):
 *   1-3 código (J17 | J22 | J38 | K16)
 *   4-12 monto (9 dígitos, 7 enteros + 2 decimales)
 *
 * Si un código no descontó nada, su bloque NO aparece (no se rellena con ceros).
 */

const HEADER_LEN = 46;
const BLOCK_LEN = 12;
const CODIGOS_VALIDOS = new Set(['J17', 'J22', 'J38', 'K16']);

export type ItemTxt = {
  /** Padrón crudo del TXT (7 dígitos). */
  padronRaw: string;
  /** Padrón en formato BD: NNNNNN-N (6 dígitos + guión + verificador). */
  padron: string;
  centro: string;
  situacion: string;
  apellidoNombre: string;
  tipoDoc: string;
  dni: number;
  /** Período en formato YYYY-MM. */
  periodo: string;
  /** Cobranzas efectivas: códigos no presentes en la línea no aparecen acá. */
  cobranzas: Partial<Record<'J17' | 'J22' | 'J38' | 'K16', number>>;
};

export type ResultadoParser = {
  items: ItemTxt[];
  /** Períodos detectados en el archivo (debería ser sólo uno). */
  periodosDetectados: string[];
  /** Líneas que no se pudieron parsear (con motivo). */
  errores: Array<{ linea: number; raw: string; motivo: string }>;
  totalLineas: number;
};

/** Convierte "2604" (AAMM) → "2026-04". Asume 20XX para el siglo. */
function aammAPeriodo(aamm: string): string | null {
  if (!/^\d{4}$/.test(aamm)) return null;
  const yy = aamm.slice(0, 2);
  const mes = aamm.slice(2, 4);
  const mesNum = Number(mes);
  if (mesNum < 1 || mesNum > 12) return null;
  return `20${yy}-${mes}`;
}

/** Convierte "4619419" → "461941-9". */
export function padronTxtABase(raw: string): string {
  if (raw.length !== 7) return raw;
  return `${raw.slice(0, 6)}-${raw.slice(6)}`;
}

function parseMonto(raw: string): number | null {
  if (!/^\d{9}$/.test(raw)) return null;
  const enteros = raw.slice(0, 7);
  const decimales = raw.slice(7, 9);
  const n = Number(`${enteros}.${decimales}`);
  return Number.isFinite(n) ? n : null;
}

/** Parsea una sola línea. Devuelve null si está vacía/inválida. */
export function parseLinea(linea: string): { item?: ItemTxt; error?: string } {
  const limpia = linea.replace(/\r$/, '');
  if (limpia.trim().length === 0) return { error: 'línea vacía' };
  if (limpia.length < HEADER_LEN) {
    return { error: `línea más corta que el header (${limpia.length} < ${HEADER_LEN})` };
  }

  const situacion = limpia.slice(0, 3).trim();
  const centro = limpia.slice(3, 5);
  const padronRaw = limpia.slice(5, 12);
  const apellidoNombre = limpia.slice(12, 33).trim().replace(/\s+/g, ' ');
  const tipoDoc = limpia.slice(33, 34);
  const dniRaw = limpia.slice(34, 42);
  const mmaa = limpia.slice(42, 46);

  if (!/^\d{7}$/.test(padronRaw)) return { error: `padrón inválido: "${padronRaw}"` };
  if (!/^\d{8}$/.test(dniRaw)) return { error: `DNI inválido: "${dniRaw}"` };
  const periodo = aammAPeriodo(mmaa);
  if (!periodo) return { error: `período inválido: "${mmaa}"` };

  const resto = limpia.slice(HEADER_LEN);
  if (resto.length % BLOCK_LEN !== 0) {
    return {
      error: `bloques de cobranza con longitud inválida (${resto.length} chars no es múltiplo de ${BLOCK_LEN})`,
    };
  }

  const cobranzas: ItemTxt['cobranzas'] = {};
  for (let i = 0; i < resto.length; i += BLOCK_LEN) {
    const bloque = resto.slice(i, i + BLOCK_LEN);
    const codigo = bloque.slice(0, 3);
    const montoRaw = bloque.slice(3, 12);

    if (!CODIGOS_VALIDOS.has(codigo)) {
      return { error: `código desconocido en bloque ${i / BLOCK_LEN + 1}: "${codigo}"` };
    }
    const monto = parseMonto(montoRaw);
    if (monto == null) {
      return { error: `monto inválido en bloque ${codigo}: "${montoRaw}"` };
    }
    cobranzas[codigo as 'J17' | 'J22' | 'J38' | 'K16'] = monto;
  }

  return {
    item: {
      padronRaw,
      padron: padronTxtABase(padronRaw),
      centro,
      situacion,
      apellidoNombre,
      tipoDoc,
      dni: Number(dniRaw),
      periodo,
      cobranzas,
    },
  };
}

/** Parsea el archivo completo. */
export function parseTxt(contenido: string): ResultadoParser {
  const lineas = contenido.split('\n');
  const items: ItemTxt[] = [];
  const errores: ResultadoParser['errores'] = [];
  const periodosDetectados = new Set<string>();

  lineas.forEach((linea, idx) => {
    if (linea.trim().length === 0) return; // saltar vacías sin contarlas como error
    const r = parseLinea(linea);
    if (r.error) {
      errores.push({ linea: idx + 1, raw: linea, motivo: r.error });
      return;
    }
    if (r.item) {
      items.push(r.item);
      periodosDetectados.add(r.item.periodo);
    }
  });

  return {
    items,
    periodosDetectados: Array.from(periodosDetectados).sort(),
    errores,
    totalLineas: lineas.filter((l) => l.trim().length > 0).length,
  };
}
