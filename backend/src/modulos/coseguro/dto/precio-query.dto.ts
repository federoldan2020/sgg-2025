import { IsDateString, IsOptional } from 'class-validator';

export class PrecioQueryDto {
  /** Fecha de vigencia para aplicar reglas (default hoy) */
  @IsOptional()
  @IsDateString()
  fecha?: string; // YYYY-MM-DD
}
