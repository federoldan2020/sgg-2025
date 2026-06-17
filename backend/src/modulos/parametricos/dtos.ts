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
