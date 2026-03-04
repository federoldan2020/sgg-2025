import { IsBooleanString, IsEnum, IsInt, IsNumberString, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Sistema } from './create-padron.dto';
import { MAX_SEARCH_TERM_LENGTH, MAX_PAGE_LIMIT } from '../../../common/sanitize';

/**
 * Query DTO para /padrones/paged
 * Se transforma con ValidationPipe({ transform: true })
 */
export class PadronesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SEARCH_TERM_LENGTH, { message: `Búsqueda máximo ${MAX_SEARCH_TERM_LENGTH} caracteres` })
  q?: string;

  @IsOptional()
  @IsNumberString()
  afiliadoId?: string;

  @IsOptional()
  @IsEnum(Sistema)
  sistema?: Sistema;

  @IsOptional()
  @IsBooleanString()
  activo?: string;

  // Paginación
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
