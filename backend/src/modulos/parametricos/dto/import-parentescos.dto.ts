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
}

export class ConfirmImportDto {
  @IsString()
  previewId: string;

  @IsBoolean()
  @IsOptional()
  ignoreWarnings?: boolean = false;
}

export interface ParentescoCsvRow {
  codigo?: string; // Código numérico del parentesco
  cod?: string;
  descripcio?: string; // Descripción del parentesco
  descripcion?: string;
  desc?: string;
  activo?: string; // Activo: 1=sí, 0=no (default true)
}

export interface ValidationIssue {
  fila: number;
  campo?: string;
  tipo: 'ERROR' | 'WARNING';
  mensaje: string;
  continuar?: boolean;
}

export interface CambioDetectado {
  anterior: any;
  nuevo: any;
}

export interface OperacionPreview {
  fila: number;
  operacion: 'CREAR' | 'ACTUALIZAR' | 'ERROR' | 'WARNING';
  codigo?: string;
  descripcion?: string;
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
