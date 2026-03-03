import { IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_SEARCH_TERM_LENGTH } from '../../../common/sanitize';

export class BuscarPracticasQueryDto {
  @IsOptional()
  @IsString()
  tipoId?: string;

  @IsOptional()
  @IsString()
  subtipoId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_TERM_LENGTH)
  q?: string;
}
