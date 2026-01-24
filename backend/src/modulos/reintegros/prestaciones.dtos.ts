export interface CrearPrestacionTipoDto {
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
  orden?: number | null;
}

export interface EditarPrestacionTipoDto {
  nombre?: string;
  descripcion?: string | null;
  activo?: boolean;
  orden?: number | null;
}

export interface CrearPrestacionSubtipoDto {
  tipoId: string | number;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
  orden?: number | null;
}

export interface EditarPrestacionSubtipoDto {
  nombre?: string;
  descripcion?: string | null;
  activo?: boolean;
  orden?: number | null;
}

export interface CrearPrestacionPracticaDto {
  tipoId: string | number;
  subtipoId?: string | number | null;
  codigo?: string | null;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
  orden?: number | null;
}

export interface EditarPrestacionPracticaDto {
  tipoId?: string | number;
  subtipoId?: string | number | null;
  codigo?: string | null;
  nombre?: string;
  descripcion?: string | null;
  activo?: boolean;
  orden?: number | null;
}

export interface CrearPrestacionReglaDto {
  tipoId?: string | number | null;
  subtipoId?: string | number | null;
  practicaId?: string | number | null;
  porcentaje?: number | null;
  tope?: number | null;
  vigenteDesde: string;
  vigenteHasta?: string | null;
  activo?: boolean;
}

export interface EditarPrestacionReglaDto {
  tipoId?: string | number | null;
  subtipoId?: string | number | null;
  practicaId?: string | number | null;
  porcentaje?: number | null;
  tope?: number | null;
  vigenteDesde?: string;
  vigenteHasta?: string | null;
  activo?: boolean;
}
