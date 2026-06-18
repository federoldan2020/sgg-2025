// Parentescos
export interface CrearParentescoDto {
  codigo: number; // p.ej. 2
  descripcion: string; // "HIJO/A"
  activo?: boolean; // default true
}
export interface EditarParentescoDto {
  descripcion?: string;
  activo?: boolean;
}

// Reglas de Coseguro (base)
export interface CrearReglaBaseDto {
  vigenteDesde: string; // "YYYY-MM-DD"
  vigenteHasta?: string; // opcional
  precioBase: number; // 25000
  activo?: boolean;
}
export interface EditarReglaBaseDto {
  vigenteHasta?: string | null;
  precioBase?: number;
  activo?: boolean;
}

// Reglas por Colateral (parentesco + tramo)
//
// Precio: se debe enviar exactamente UNO de `precioPorColateral` o `precioTotal`.
//   - precioPorColateral: monto por cada colateral del tramo (se multiplica por cantidad).
//   - precioTotal: monto fijo total del grupo en ese tramo (semántica histórica).
// `parentescoCodigo` ahora es opcional: null/undefined = regla comodín
// (aplica a cualquier parentesco; pierde frente a reglas específicas).
export interface CrearReglaColateralDto {
  parentescoCodigo?: number | null;
  cantidadDesde: number; // ej 1
  cantidadHasta?: number | null; // ej null = ∞
  vigenteDesde: string;
  vigenteHasta?: string;
  precioPorColateral?: number;
  precioTotal?: number;
  activo?: boolean;
}
export interface EditarReglaColateralDto {
  parentescoCodigo?: number | null;
  cantidadDesde?: number;
  cantidadHasta?: number | null;
  vigenteHasta?: string | null;
  precioPorColateral?: number | null;
  precioTotal?: number | null;
  activo?: boolean;
}

// =============================================================================
// Reglas de cobertura (cupo de órdenes de farmacia por mes por afiliado titular)
// =============================================================================
export interface CrearReglaCoberturaDto {
  ordenesPorMes: number; // ej. 4
  vigenteDesde: string; // YYYY-MM-DD
  vigenteHasta?: string | null;
  activo?: boolean;
}

export interface EditarReglaCoberturaDto {
  ordenesPorMes?: number;
  vigenteHasta?: string | null;
  activo?: boolean;
}

// =============================================================================
// Reglas de clasificación de integrantes (GF / J38 / SIN_COBERTURA)
// =============================================================================
export type ClasifResultadoDto = 'GF' | 'J38' | 'SIN_COBERTURA';

export interface CrearReglaClasificacionDto {
  /** null/omitido = cualquier parentesco. */
  parentescoCodigo?: number | null;
  /** null/omitido = cualquier sexo del titular. */
  sexoTitular?: 'M' | 'F' | 'X' | null;
  edadDesde?: number | null;
  edadHasta?: number | null;
  /** null = no importa; true/false = requiere ese valor exacto. */
  requiereEstudiante?: boolean | null;
  requiereAportes?: boolean | null;
  requiereDiscapacidad?: boolean | null;
  resultado: ClasifResultadoDto;
  prioridad: number;
  vigenteDesde: string; // YYYY-MM-DD
  vigenteHasta?: string | null;
  activo?: boolean;
  descripcion?: string | null;
}

export interface EditarReglaClasificacionDto {
  parentescoCodigo?: number | null;
  sexoTitular?: 'M' | 'F' | 'X' | null;
  edadDesde?: number | null;
  edadHasta?: number | null;
  requiereEstudiante?: boolean | null;
  requiereAportes?: boolean | null;
  requiereDiscapacidad?: boolean | null;
  resultado?: ClasifResultadoDto;
  prioridad?: number;
  vigenteHasta?: string | null;
  activo?: boolean;
  descripcion?: string | null;
}

/** Body para reordenar masivamente las prioridades. */
export interface ReordenarReglasClasificacionDto {
  /** Lista de { id, prioridad }. Permite drag-and-drop frontend. */
  orden: { id: string; prioridad: number }[];
}
