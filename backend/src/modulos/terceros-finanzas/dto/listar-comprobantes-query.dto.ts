import { IsEnum, IsNumberString, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RolTercero } from '@prisma/client';
import { EstadoComprobanteTercero } from '@prisma/client';
import { MAX_SEARCH_TERM_LENGTH, MAX_PAGE_LIMIT } from '../../../common/sanitize';

export class ListarComprobantesQueryDto {
  @IsString()
  organizacionId!: string;

  @IsOptional()
  @IsEnum(RolTercero)
  rol?: RolTercero;

  @IsOptional()
  @IsEnum(EstadoComprobanteTercero)
  estado?: EstadoComprobanteTercero;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_TERM_LENGTH)
  q?: string;

  @IsOptional()
  @IsNumberString()
  @Type(() => Number)
  @Min(1)
  page?: string;

  @IsOptional()
  @IsNumberString()
  @Type(() => Number)
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  pageSize?: string;
}
