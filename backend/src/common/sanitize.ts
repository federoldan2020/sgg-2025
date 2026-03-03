/**
 * Utilidades de sanitización para reducir riesgo de inyección y abuso.
 * Prisma ya usa consultas parametrizadas (protección frente a SQL injection);
 * aquí se limitan longitudes y se normalizan entradas de búsqueda.
 */

/** Longitud máxima recomendada para términos de búsqueda (evita DoS y payloads enormes). */
export const MAX_SEARCH_TERM_LENGTH = 200;

/** Límite máximo de resultados por página en listados/búsquedas. */
export const MAX_PAGE_LIMIT = 100;

/**
 * Sanitiza un término de búsqueda para usar en filtros (contains, etc.).
 * - Recorta espacios y limita longitud.
 * - No modifica caracteres; Prisma usa parámetros, no concatenación SQL.
 */
export function sanitizeSearchTerm(
  value: string | undefined | null,
  maxLength: number = MAX_SEARCH_TERM_LENGTH,
): string {
  if (value == null || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

/**
 * Valida que una cadena sea un UUID v4 (para IDs de organización, etc.).
 * Útil antes de interpolar en scripts o logs.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSafeUuid(value: string | undefined | null): boolean {
  if (value == null || typeof value !== 'string') return false;
  return UUID_REGEX.test(value.trim());
}

/**
 * Asegura un límite de paginación dentro de rango [1, MAX_PAGE_LIMIT].
 */
export function clampPageLimit(limit: number | undefined | null): number {
  if (limit == null || !Number.isFinite(limit) || limit < 1) return 20;
  return Math.min(Math.floor(limit), MAX_PAGE_LIMIT);
}
