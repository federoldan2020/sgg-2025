import { IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';

import { AfiliadoTipo } from './create-afiliado.dto';

/**
 * Query DTO para /afiliados/paged
 * Se transforma con ValidationPipe({ transform: true })
 */
export class AfiliadosQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsEnum(AfiliadoTipo)
  tipo?: AfiliadoTipo;

  // Nuevos filtros
  @IsOptional()
  @IsString()
  conCoseguro?: string; // "true" | "false"

  @IsOptional()
  @IsString()
  conColaterales?: string; // "true" | "false"

  // Paginación
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
