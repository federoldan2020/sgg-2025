/**
 * Tipos compartidos entre la página de detalle de coseguro y sus tabs.
 * Reflejan la forma actual del backend; cuando el backend cambie, este
 * archivo es el único lugar a tocar en el frontend.
 */

export type EstadoCoseguro = "activo" | "baja" | "ninguno";

export type AfiliadoLite = {
  id: string | number;
  dni?: string | number | null;
  apellido?: string | null;
  nombre?: string | null;
};

export type PadronLite = {
  id: string | number;
  padron: string;
  activo?: boolean;
};

export type CoseguroCfg = {
  estado: EstadoCoseguro;
  fechaAlta?: string | null;
  fechaBaja?: string | null;
  padronCoseguroId?: string | number | null; // J22
  padronColatId?: string | number | null; // J38
};

export type Colateral = {
  id: string | number;
  parentescoId: string | number;
  parentescoNombre?: string | null;
  nombre: string;
  dni?: string | null;
  fechaNacimiento?: string | null;
  activo: boolean;
  esColateral?: boolean; // participa en J38
  // Flags nuevos del modelo (pueden venir undefined del backend viejo)
  esEstudiante?: boolean;
  esDiscapacitado?: boolean;
  tieneAportes?: boolean;
};

export type PrecioResumen = {
  coseguro?: number | string | null;
  colaterales?: number | string | null;
  total?: number | string | null;
};

export type Parentesco = {
  id: string | number;
  nombre: string;
};
