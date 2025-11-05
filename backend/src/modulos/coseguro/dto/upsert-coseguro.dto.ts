import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpsertCoseguroDto {
  /** Fecha de alta del beneficio (requerida al crear si no existe todavía) */
  @IsOptional()
  @IsDateString()
  fechaAlta?: string; // YYYY-MM-DD

  /** Fecha de baja administrativa (opcional) */
  @IsOptional()
  @IsDateString()
  fechaBaja?: string; // YYYY-MM-DD

  /** Estado libre: 'activo' | 'baja' | ... */
  @IsOptional()
  @IsString()
  estado?: string;

  /** Imputación por defecto del coseguro (padrón) */
  @IsOptional()
  @IsNumber()
  imputacionPadronIdCoseguro?: number;

  /** Imputación por defecto de colaterales (padrón) */
  @IsOptional()
  @IsNumber()
  imputacionPadronIdColaterales?: number;

  /** Atajos de habilitación */
  @IsOptional()
  @IsBoolean()
  habilitarCoseguro?: boolean;

  @IsOptional()
  @IsBoolean()
  habilitarColaterales?: boolean;
}
