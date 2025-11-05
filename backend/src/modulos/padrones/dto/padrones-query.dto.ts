import { IsBooleanString, IsEnum, IsNumberString, IsOptional, IsString } from 'class-validator';
import { Sistema } from './create-padron.dto';

/**
 * Query DTO para /padrones/paged
 * Se transforma con ValidationPipe({ transform: true })
 */
export class PadronesQueryDto {
  @IsOptional()
  @IsString()
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
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
