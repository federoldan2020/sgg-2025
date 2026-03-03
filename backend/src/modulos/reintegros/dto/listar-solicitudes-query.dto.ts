import { IsNumberString, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_SEARCH_TERM_LENGTH, MAX_PAGE_LIMIT } from '../../../common/sanitize';

export class ListarSolicitudesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_TERM_LENGTH)
  q?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  afiliadoId?: string;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

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
