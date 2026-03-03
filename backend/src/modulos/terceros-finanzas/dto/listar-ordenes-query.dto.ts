import { IsEnum, IsNumberString, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RolTercero } from '@prisma/client';
import { EstadoOrdenPago } from '@prisma/client';
import { MAX_SEARCH_TERM_LENGTH, MAX_PAGE_LIMIT } from '../../../common/sanitize';

export class ListarOrdenesPagoQueryDto {
  @IsString()
  organizacionId!: string;

  @IsOptional()
  @IsEnum(RolTercero)
  rol?: RolTercero;

  @IsOptional()
  @IsEnum(EstadoOrdenPago)
  estado?: EstadoOrdenPago;

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
