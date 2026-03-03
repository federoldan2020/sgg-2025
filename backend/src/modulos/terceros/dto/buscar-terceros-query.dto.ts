import { IsEnum, IsNumberString, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RolTercero } from '@prisma/client';
import { MAX_SEARCH_TERM_LENGTH, MAX_PAGE_LIMIT } from '../../../common/sanitize';

/**
 * Query DTO para GET /terceros/buscar
 */
export class BuscarTercerosQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_TERM_LENGTH, { message: `Búsqueda máximo ${MAX_SEARCH_TERM_LENGTH} caracteres` })
  q?: string;

  @IsOptional()
  @IsEnum(RolTercero)
  rol?: RolTercero;

  @IsOptional()
  @IsNumberString()
  @Type(() => Number)
  @Min(1, { message: 'limit debe ser al menos 1' })
  @Max(MAX_PAGE_LIMIT, { message: `limit máximo ${MAX_PAGE_LIMIT}` })
  limit?: string;
}
