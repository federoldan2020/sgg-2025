// =============================================================
// src/afiliados/dto/create-afiliado.dto.ts
// =============================================================
import { IsEnum, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';

export enum Sexo {
  M = 'M',
  F = 'F',
  X = 'X',
}

export enum AfiliadoTipo {
  TITULAR = 'TITULAR',
  FAMILIAR = 'FAMILIAR',
  JUBILADO = 'JUBILADO',
  OTRO = 'OTRO',
}

/**
 * Notas:
 * - Usamos string para decimales (cupo/saldo) por compatibilidad con Prisma.Decimal.
 * - fechaNacimiento en ISO (YYYY-MM-DD) o ISO completo; el service lo convierte a Date.
 */
export class CreateAfiliadoDto {
  // Requeridos
  @IsNumber() dni!: number;
  @IsString() apellido!: string;
  @IsString() nombre!: string;

  // Personales
  @IsOptional() @IsString() cuit?: string;
  @IsOptional() @IsEnum(Sexo) sexo?: Sexo;
  @IsOptional() @IsEnum(AfiliadoTipo) tipo?: AfiliadoTipo;

  // Contacto
  @IsOptional() @IsString() telefono?: string;
  @IsOptional() @IsString() celular?: string;

  // Domicilio
  @IsOptional() @IsString() calle?: string;
  @IsOptional() @IsString() numero?: string;
  @IsOptional() @IsString() orientacion?: string;
  @IsOptional() @IsString() barrio?: string;
  @IsOptional() @IsString() piso?: string;
  @IsOptional() @IsString() depto?: string;
  @IsOptional() @IsString() monoblock?: string;
  @IsOptional() @IsString() casa?: string;
  @IsOptional() @IsString() manzana?: string;
  @IsOptional() @IsString() localidad?: string;

  // Otros
  @IsOptional() @IsDateString() fechaNacimiento?: string;
  @IsOptional() @IsString() numeroSocio?: string;
  @IsOptional() @IsString() cupo?: string; // Decimal
  @IsOptional() @IsString() saldo?: string; // Decimal
  @IsOptional() @IsString() observaciones?: string;
}
