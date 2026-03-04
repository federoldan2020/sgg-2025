import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

import { AfiliadoTipo } from './create-afiliado.dto';
import { MAX_SEARCH_TERM_LENGTH, MAX_PAGE_LIMIT } from '../../../common/sanitize';

/**
 * Query DTO para /afiliados/paged
 * Se transforma con ValidationPipe({ transform: true })
 */
export class AfiliadosQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_TERM_LENGTH, { message: `Búsqueda máximo ${MAX_SEARCH_TERM_LENGTH} caracteres` })
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

  // Paginación (transform convierte query string → number; validamos como número)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'limit debe ser al menos 1' })
  @Max(MAX_PAGE_LIMIT, { message: `limit máximo ${MAX_PAGE_LIMIT}` })
  limit?: number;
}
