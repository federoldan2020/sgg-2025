/**
 * Parser del TXT de retorno de ANSES (archivo UDAME) para jubilados/pensionados.
 *
 * Documentación funcional completa en: docs/UDAME_format.md
 *
 * Formato:
 *   - Encoding latin-1 (ISO-8859-1).
 *   - Línea fija de 103 chars útiles + 28 bytes nulos (\x00) + CRLF.
 *   - Cada línea = un descuento J17 por beneficio ANSES.
 *
 * Layout (posiciones 1-indexed inclusive):
 *
 *   1-11    beneficio (11 chars numéricos, conservar como string)
 *   12-33   apellido y nombre (22 chars, padded con espacios)
 *   34-36   tipo de prestación (ignorable)
 *   37-44   DNI (8 dígitos)
 *   45-47   constante "325" (ignorable)
 *   48-61   zona administrativa (ignorable)
 *   62-72   monto descontado (11 dígitos = 9 enteros + 2 decimales)
 *   73-76   período MMAA  → Junio 2026 = "0626"
 *   77-87   CUIT (11 dígitos)
 *   88-97   fecha de nacimiento DD.MM.YYYY (con puntos)
 *   98      sexo (F | M)
 *   99-100  padding 2 espacios
 *   101-103 organismo (siempre "UDA")
 *
 * Para ANSES sólo viene J17 (cuota societaria). J22/J38/K16 NO se descuentan
 * por este canal — los jubilados los pagan por caja/débito automático.
 */

export const LARGO_UTIL = 103;

export type ItemAnses = {
  beneficio: string;
  apellidoNombre: string;
  tipoPrestacion: string;
  /** DNI numérico (8 dígitos sin ceros padding al exportar). */
  dni: number;
  /** DNI con padding a 8 dígitos (string), útil para matching. */
  dniRaw: string;
  /** Monto J17 efectivamente descontado. */
  monto: number;
  /** Período en formato YYYY-MM. */
  periodo: string;
  cuit: string;
  fechaNacimiento: Date | null;
  sexo: 'F' | 'M' | string;
  organismo: string;
};

export type ResultadoParserAnses = {
  items: ItemAnses[];
  /** Períodos detectados en el archivo (debería ser uno solo). */
  periodosDetectados: string[];
  /** Líneas que no se pudieron parsear (con motivo). */
  errores: Array<{ linea: number; raw: string; motivo: string }>;
  /** Advertencias de integridad (CUIT/DNI mismatch, etc.) que no detienen el parseo. */
  warnings: Array<{ linea: number; mensaje: string }>;
  totalLineas: number;
};

/** Convierte "0626" (MMAA) → "2026-06". Asume 20XX. */
function mmaaAPeriodo(mmaa: string): string | null {
  if (!/^\d{4}$/.test(mmaa)) return null;
  const mes = mmaa.slice(0, 2);
  const yy = mmaa.slice(2, 4);
  const mesNum = Number(mes);
  if (mesNum < 1 || mesNum > 12) return null;
  return `20${yy}-${mes}`;
}

/** Parsea "DD.MM.YYYY" → Date UTC. */
function parseFechaNacimiento(raw: string): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Parsea una sola línea. Antes de pasarla, hay que strippear bytes nulos
 * (\x00) y terminadores (\r\n). Devuelve `error` si no cumple el formato.
 */
export function parseLineaAnses(linea: string): {
  item?: ItemAnses;
  error?: string;
  warning?: string;
} {
  // Stripear bytes nulos y CR/LF; los nulos vienen como padding tras el char 103.
  const limpia = linea.replace(/[\x00\r\n]+$/g, '');
  if (limpia.length === 0) return { error: 'línea vacía' };
  if (limpia.length < LARGO_UTIL) {
    return { error: `línea más corta que ${LARGO_UTIL} chars (vino ${limpia.length})` };
  }

  const beneficio = limpia.slice(0, 11);
  const apellidoNombre = limpia.slice(11, 33).trim().replace(/\s+/g, ' ');
  const tipoPrestacion = limpia.slice(33, 36).trim();
  const dniRaw = limpia.slice(36, 44);
  // 44-47 constante "325" (no validamos, no se usa)
  // 47-61 zona administrativa (no se usa)
  const montoRaw = limpia.slice(61, 72);
  const periodoRaw = limpia.slice(72, 76);
  const cuit = limpia.slice(76, 87);
  const fechaNacRaw = limpia.slice(87, 97);
  const sexo = limpia.slice(97, 98);
  // 98-100 padding 2 espacios
  const organismo = limpia.slice(100, 103);

  if (!/^\d{11}$/.test(beneficio)) {
    return { error: `beneficio inválido: "${beneficio}"` };
  }
  if (!/^\d{8}$/.test(dniRaw)) {
    return { error: `DNI inválido: "${dniRaw}"` };
  }
  if (!/^\d{11}$/.test(montoRaw)) {
    return { error: `monto inválido: "${montoRaw}"` };
  }
  const periodo = mmaaAPeriodo(periodoRaw);
  if (!periodo) {
    return { error: `período inválido: "${periodoRaw}"` };
  }
  if (!/^\d{11}$/.test(cuit)) {
    return { error: `CUIT inválido: "${cuit}"` };
  }

  const monto = Number(montoRaw) / 100;
  if (!Number.isFinite(monto) || monto < 0) {
    return { error: `monto no numérico: "${montoRaw}"` };
  }

  const fechaNacimiento = parseFechaNacimiento(fechaNacRaw);
  if (!fechaNacimiento) {
    return { error: `fecha nacimiento inválida: "${fechaNacRaw}"` };
  }

  // Warning (no error) si DNI no aparece dentro del CUIT.
  let warning: string | undefined;
  if (cuit.slice(2, 10) !== dniRaw) {
    warning = `DNI "${dniRaw}" no coincide con CUIT[2..10] "${cuit.slice(2, 10)}"`;
  }

  // Warning si organismo no es "UDA".
  if (organismo !== 'UDA') {
    warning = (warning ?? '') + (warning ? ' · ' : '') + `organismo inesperado: "${organismo}"`;
  }

  return {
    item: {
      beneficio,
      apellidoNombre,
      tipoPrestacion,
      dni: Number(dniRaw),
      dniRaw,
      monto,
      periodo,
      cuit,
      fechaNacimiento,
      sexo,
      organismo,
    },
    warning,
  };
}

/**
 * Parsea el archivo completo. Acepta el string ya decodificado (latin-1
 * decodificado a UTF-16 interno de JS). La conversión de bytes a string
 * la hace el caller (típicamente el controller con
 * `Buffer.from(...).toString('latin1')`).
 */
export function parseTxtAnses(contenido: string): ResultadoParserAnses {
  const lineas = contenido.split('\n');
  const items: ItemAnses[] = [];
  const errores: ResultadoParserAnses['errores'] = [];
  const warnings: ResultadoParserAnses['warnings'] = [];
  const periodosDetectados = new Set<string>();
  let lineasUtiles = 0;

  lineas.forEach((linea, idx) => {
    const limpia = linea.replace(/[\x00\r\n]+$/g, '');
    if (limpia.length === 0) return;
    lineasUtiles++;
    const r = parseLineaAnses(linea);
    if (r.error) {
      errores.push({ linea: idx + 1, raw: linea.slice(0, 130), motivo: r.error });
      return;
    }
    if (r.item) {
      items.push(r.item);
      periodosDetectados.add(r.item.periodo);
    }
    if (r.warning) {
      warnings.push({ linea: idx + 1, mensaje: r.warning });
    }
  });

  return {
    items,
    periodosDetectados: Array.from(periodosDetectados).sort(),
    errores,
    warnings,
    totalLineas: lineasUtiles,
  };
}
