import { IsEnum, IsOptional, IsBoolean, IsString } from 'class-validator';

export enum ImportMode {
  CREATE_ONLY = 'create_only',
  UPDATE_ONLY = 'update_only',
  UPSERT = 'upsert',
}

export enum MergeStrategy {
  KEEP_NEW_IF_PRESENT = 'keep_new_if_present',
  ALWAYS_KEEP_NEW = 'always_keep_new',
  KEEP_EXISTING = 'keep_existing',
}

export class ImportOptionsDto {
  @IsEnum(ImportMode)
  @IsOptional()
  mode?: ImportMode = ImportMode.UPSERT;

  @IsEnum(MergeStrategy)
  @IsOptional()
  mergeStrategy?: MergeStrategy = MergeStrategy.KEEP_NEW_IF_PRESENT;

  @IsBoolean()
  @IsOptional()
  skipEmptyFields?: boolean = true;

  @IsBoolean()
  @IsOptional()
  validateCuit?: boolean = true;

  @IsBoolean()
  @IsOptional()
  validateDuplicates?: boolean = true;
}

export class ConfirmImportDto {
  @IsString()
  previewId: string;

  @IsBoolean()
  @IsOptional()
  ignoreWarnings?: boolean = false;
}

export interface AfiliadoCsvRow {
  dni: string;
  apellido: string;
  nombre: string;
  cuit?: string;
  sexo?: string;
  tipo?: string;
  fechaNacimiento?: string;
  telefono?: string;
  celular?: string;
  email?: string;
  calle?: string;
  numero?: string;
  piso?: string;
  depto?: string;
  orientacion?: string;
  barrio?: string;
  monoblock?: string;
  casa?: string;
  manzana?: string;
  localidad?: string;
  numeroSocio?: string;
  cupo?: string;
  observaciones?: string;
  _modo?: string;
}

export interface ValidationIssue {
  fila: number;
  campo?: string;
  tipo: 'ERROR' | 'WARNING';
  mensaje: string;
  continuar?: boolean;
}

export interface CambioDetectado {
  campo: string;
  anterior: any;
  nuevo: any;
}

export interface OperacionPreview {
  fila: number;
  operacion: 'CREAR' | 'ACTUALIZAR' | 'ERROR' | 'WARNING';
  dni: string;
  nombre?: string;
  status: 'OK' | 'ERROR' | 'WARNING';
  mensaje?: string;
  cambios?: Record<string, CambioDetectado> | null;
  continuar?: boolean;
}

export interface ImportPreviewResponse {
  previewId: string;
  resumen: {
    total: number;
    aCrear: number;
    aActualizar: number;
    errores: number;
    warnings: number;
  };
  operaciones: OperacionPreview[];
  puedeConfirmar: boolean;
}

export interface ImportResultResponse {
  exitoso: boolean;
  resumen: {
    total: number;
    creados: number;
    actualizados: number;
    errores: number;
  };
  errores?: Array<{
    fila: number;
    mensaje: string;
  }>;
}
