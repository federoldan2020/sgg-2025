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

export interface ColateralCsvRow {
  doc_titula?: string; // DNI del titular/afiliado
  dni_titular?: string;
  titular_dni?: string;
  cod_par?: string; // Código de parentesco
  codigo_parentesco?: string;
  parentesco_codigo?: string;
  ape_nom?: string; // Apellido y nombre del familiar
  apellido_nombre?: string;
  nombre?: string;
  apellido?: string;
  sexo?: string; // M/F (opcional, no se usa actualmente)
  documento?: string; // DNI del familiar
  dni?: string;
  fecha_nac?: string; // Fecha de nacimiento DD/MM/YYYY
  fecha_nacimiento?: string;
  fecha_ing?: string; // Fecha de ingreso (opcional)
  fecha_ingreso?: string;
  fecha_eg?: string; // Fecha de egreso (opcional)
  fecha_egreso?: string;
  motivo_eg?: string; // Motivo de egreso (opcional)
  motivo_egreso?: string;
  c?: string; // Colateral: 1=sí, 0=no
  es_colateral?: string;
  activo?: string; // Activo: 1=sí, 0=no (derivado de fecha_eg)
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
  dniTitular?: string;
  nombreFamiliar?: string;
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
