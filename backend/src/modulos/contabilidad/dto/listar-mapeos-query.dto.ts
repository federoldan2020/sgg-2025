import { IsNumberString, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_SEARCH_TERM_LENGTH, MAX_PAGE_LIMIT } from '../../../common/sanitize';

export class ListarMapeosQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_TERM_LENGTH)
  q?: string;

  @IsOptional()
  @IsString()
  origen?: string;

  @IsOptional()
  @IsString()
  activo?: string;

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
