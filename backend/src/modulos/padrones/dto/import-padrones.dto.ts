import { IsEnum, IsOptional, IsBoolean, IsString } from 'class-validator';

export enum ImportMode {
  CREATE_ONLY = 'create_only',
  UPDATE_ONLY = 'update_only',
  UPSERT = 'upsert',
}

export class ImportOptionsDto {
  @IsEnum(ImportMode)
  @IsOptional()
  mode?: ImportMode = ImportMode.UPSERT;

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

export interface PadronCsvRow {
  dni: string;
  padron: string;
  centro?: string;
  sector?: string;
  clase?: string;
  situacion?: string;
  fechaAlta?: string;
  fechaBaja?: string;
  activo?: string; // SI/NO
  j17?: string;
  j22?: string;
  j38?: string;
  k16?: string;
  sistema?: string; // ESC/SGR/SG
  sueldoBasico?: string;
  cupo?: string;
  _modo?: string;
}

export interface OperacionPreview {
  fila: number;
  operacion: 'CREAR' | 'ACTUALIZAR' | 'ERROR' | 'WARNING';
  padron: string;
  dni: string;
  status: 'OK' | 'ERROR' | 'WARNING';
  mensaje?: string;
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
  errores?: Array<{ fila: number; mensaje: string }>;
}
