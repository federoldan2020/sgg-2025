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
export interface CrearReglaColateralDto {
  parentescoCodigo: number; // ej 2 = HIJO/A
  cantidadDesde: number; // ej 1
  cantidadHasta?: number | null; // ej null = ∞
  vigenteDesde: string;
  vigenteHasta?: string;
  precioTotal: number; // importe total para el tramo
  activo?: boolean;
}
export interface EditarReglaColateralDto {
  cantidadDesde?: number;
  cantidadHasta?: number | null;
  vigenteHasta?: string | null;
  precioTotal?: number;
  activo?: boolean;
}
