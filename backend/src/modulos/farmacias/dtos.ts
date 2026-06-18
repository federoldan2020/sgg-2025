import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CrearFarmaciaDto {
  @IsString() @MaxLength(40) codigo!: string;
  @IsString() @MaxLength(200) nombre!: string;
  @IsOptional() @IsString() @MaxLength(20) cuit?: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsString() @MaxLength(100) localidad?: string;
  @IsOptional() @IsString() @MaxLength(40) telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsBoolean() esInterna?: boolean;
  /** Usuario para login de la vista pública (solo si !esInterna). */
  @IsOptional() @IsString() @MaxLength(50) usuario?: string;
  /** Password inicial (si se omite y es externa, lo genera el backend). */
  @IsOptional() @IsString() @MinLength(8) @MaxLength(80) password?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class EditarFarmaciaDto {
  @IsOptional() @IsString() @MaxLength(200) nombre?: string;
  @IsOptional() @IsString() @MaxLength(20) cuit?: string;
  @IsOptional() @IsString() @MaxLength(200) direccion?: string;
  @IsOptional() @IsString() @MaxLength(100) localidad?: string;
  @IsOptional() @IsString() @MaxLength(40) telefono?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(50) usuario?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class CambiarPasswordFarmaciaDto {
  @IsString() @MinLength(8) @MaxLength(80) password!: string;
}

export class LoginFarmaciaDto {
  @IsString() @MaxLength(50) usuario!: string;
  @IsString() @MaxLength(80) password!: string;
}

export class RegistrarConsumoDto {
  @IsString() dni!: string;
  /** Quién consumió: titular o un integrante del grupo. */
  @IsOptional() @IsString() integranteId?: string | null;
  @IsOptional() observacion?: string | null;
  /** Monto opcional (algunas farmacias no lo registran). */
  @IsOptional() monto?: number | null;
}

export class AnularConsumoDto {
  @IsString() @MinLength(3) motivo!: string;
}
