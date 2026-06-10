/**
 * Helpers de formato para el archivo TXT de novedades a Cómputos San Juan.
 *
 * Formato (decisiones 24-28 del doc CIRCUITO_AFILIADOS_DEUDA_SUSPENSION):
 *   - Línea de 80 chars fijos.
 *   - Posiciones (1-indexed):
 *       1-2   centro (2 dígitos)
 *       3-8   6 espacios fijos
 *       9-15  padrón crudo (7 dígitos, último = verificador)
 *       16-N  bloques de 12 chars cada uno (código 3 + monto 9 con 2 decimales)
 *       …relleno con espacios…
 *       79-80 indicador final (ej. "B3")
 */

export const ANCHO_LINEA = 80;
export const INDICADOR_DEFAULT = 'B3';
export const J17_ALTA_VALOR = 200; // valor literal marcador de "alta J17"

export type CodigoNovedad = 'J17' | 'J22' | 'J38' | 'K16';

export type BloqueNovedad = {
  codigo: CodigoNovedad;
  /** Importe; 0 indica baja para ese código. */
  monto: number;
};

/**
 * Convierte un padrón en formato BD ("123456-7") o crudo ("1234567") al
 * formato de 7 dígitos sin guión que va al archivo.
 */
export function padronToTxt(padron: string): string {
  const onlyDigits = String(padron).replace(/\D+/g, '');
  if (onlyDigits.length === 0) return '0000000';
  return onlyDigits.padStart(7, '0').slice(-7);
}

/** Centro como 2 dígitos. */
export function centroToTxt(centro: number | null | undefined): string {
  if (centro == null) return '00';
  return String(centro).padStart(2, '0').slice(-2);
}

/** Monto a 9 chars (7 enteros + 2 decimales) sin punto. */
export function montoToTxt(monto: number): string {
  const centavos = Math.round(monto * 100);
  return String(Math.max(0, centavos)).padStart(9, '0');
}

/** Construye una línea de novedad completa (80 chars). */
export function armarLinea(input: {
  centro: number | null | undefined;
  padron: string;
  bloques: BloqueNovedad[];
  indicador?: string;
}): string {
  const indicador = (input.indicador ?? INDICADOR_DEFAULT).padEnd(2, ' ').slice(0, 2);

  const header = centroToTxt(input.centro) + '      ' + padronToTxt(input.padron); // 2+6+7=15
  const bloquesStr = input.bloques
    .map((b) => b.codigo + montoToTxt(b.monto))
    .join('');

  // Sin contar indicador final ni relleno
  const datos = header + bloquesStr;
  const espaciosRelleno = ANCHO_LINEA - datos.length - indicador.length;
  if (espaciosRelleno < 0) {
    // Demasiados bloques (> 5). En la práctica no debería pasar (J17/J22/J38/K16 = 4 máx).
    throw new Error(
      `Línea excede ${ANCHO_LINEA} caracteres: ${datos.length + indicador.length}`,
    );
  }
  return datos + ' '.repeat(espaciosRelleno) + indicador;
}

/** Validación de la línea generada. */
export function validarLinea(linea: string) {
  if (linea.length !== ANCHO_LINEA) {
    throw new Error(`Línea con longitud ${linea.length}, esperado ${ANCHO_LINEA}`);
  }
}

/** Tipo de movimiento derivado de los bloques. */
export function clasificarTipo(bloques: BloqueNovedad[]): 'alta' | 'baja' | 'mixto' | 'k16_solo' {
  if (bloques.length === 1 && bloques[0].codigo === 'K16') return 'k16_solo';
  const tieneAlta = bloques.some((b) => b.monto > 0);
  const tieneBaja = bloques.some((b) => b.monto === 0);
  if (tieneAlta && tieneBaja) return 'mixto';
  if (tieneAlta) return 'alta';
  return 'baja';
}

/** Nombre sugerido del archivo. */
export function nombreArchivo(periodo: string, canal: string): string {
  return `NOV_${periodo}_${canal}.txt`;
}
