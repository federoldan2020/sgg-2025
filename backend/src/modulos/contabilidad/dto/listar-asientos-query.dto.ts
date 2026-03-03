import { IsNumberString, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_SEARCH_TERM_LENGTH, MAX_PAGE_LIMIT } from '../../../common/sanitize';

export class ListarAsientosQueryDto {
  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

  @IsOptional()
  @IsString()
  origen?: string;

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
