import { PartialType } from '@nestjs/mapped-types';
import { CreateAfiliadoDto } from './create-afiliado.dto';
import { IsOptional, IsString } from 'class-validator';

/**
 * Extiende CreateAfiliadoDto; permite actualizar estado para soft delete.
 */
export class UpdateAfiliadoDto extends PartialType(CreateAfiliadoDto) {
  @IsOptional() @IsString() estado?: string; // p.ej. 'activo' | 'baja'
}
