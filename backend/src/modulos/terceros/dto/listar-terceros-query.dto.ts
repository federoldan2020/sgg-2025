import { IsEnum, IsNumberString, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RolTercero } from '@prisma/client';
import { MAX_SEARCH_TERM_LENGTH, MAX_PAGE_LIMIT } from '../../../common/sanitize';

export class ListarTercerosQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_TERM_LENGTH, { message: `Búsqueda máximo ${MAX_SEARCH_TERM_LENGTH} caracteres` })
  q?: string;

  @IsOptional()
  @IsEnum(RolTercero)
  rol?: RolTercero;

  @IsOptional()
  @IsString()
  activo?: string; // "true" | "false"

  @IsOptional()
  @IsNumberString()
  @Type(() => Number)
  @Min(1, { message: 'page debe ser al menos 1' })
  page?: string;

  @IsOptional()
  @IsNumberString()
  @Type(() => Number)
  @Min(1, { message: 'pageSize debe ser al menos 1' })
  @Max(MAX_PAGE_LIMIT, { message: `pageSize máximo ${MAX_PAGE_LIMIT}` })
  pageSize?: string;
}
