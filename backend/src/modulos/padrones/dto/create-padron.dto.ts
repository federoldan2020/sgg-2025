// =============================================================
// src/padrones/dto/create-padron.dto.ts
// =============================================================
// =============================================================
// src/modulos/padrones/dto/create-padron.dto.ts
// =============================================================
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateAfiliadoDto } from '../../afiliados/dto/create-afiliado.dto';

export enum Sistema {
  ESC = 'ESC',
  SGR = 'SGR',
  SG = 'SG',
}

/**
 * Colateral mínimo para alta “rápida” junto al padrón (opcional).
 * (Los colaterales cuelgan del coseguro del afiliado.)
 */
export class ColateralMinDto {
  @IsNumber()
  parentescoId!: number;

  @IsString()
  @MaxLength(200)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  dni?: string; // ← NUEVO (unique por afiliado en BD)

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string; // YYYY-MM-DD

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

/**
 * Notas:
 * - Podés enviar EITHER `afiliadoId` OR `afiliadoNuevo` (uno de los dos).
 * - Decimales como string (j17/j22/j38/k16/sueldoBasico/cupo/saldo).
 * - `activo` por defecto true si no viene informado.
 * - `crearCoseguro`: si true y el afiliado no tiene coseguro, se crea imputando este padrón.
 * - `colaterales`: opcional, solo si `crearCoseguro` es true (no se valida rígido para no bloquear).
 */
export class CreatePadronDto {
  // --- Identificación de afiliado ---
  @ValidateIf((o) => !o.afiliadoNuevo)
  @IsInt()
  @Min(1)
  afiliadoId?: number;

  @ValidateIf((o) => !o.afiliadoId)
  @ValidateNested()
  @Type(() => CreateAfiliadoDto)
  afiliadoNuevo?: CreateAfiliadoDto;

  // --- Datos obligatorios del padrón ---
  @IsString()
  padron!: string;

  // --- Datos base ---
  @IsOptional()
  @IsInt()
  centro?: number;

  @IsOptional()
  @IsInt()
  sector?: number;

  @IsOptional()
  @IsString()
  clase?: string;

  @IsOptional()
  @IsString()
  situacion?: string;

  // --- Fechas / estado ---
  @IsOptional()
  @IsDateString()
  fechaAlta?: string; // YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  fechaBaja?: string; // YYYY-MM-DD

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  // --- Códigos / importes (string por Decimal) ---
  @IsOptional()
  @IsString()
  j17?: string;

  @IsOptional()
  @IsString()
  j22?: string;

  @IsOptional()
  @IsString()
  j38?: string;

  @IsOptional()
  @IsString()
  k16?: string;

  // --- Jubilados / bancarios ---
  @IsOptional()
  @IsString()
  motivoBaja?: string;

  @IsOptional()
  @IsString()
  cajaAhorro?: string;

  @IsOptional()
  @IsString()
  beneficiarioJubilado?: string;

  // --- Sistema / importes ---
  @IsOptional()
  @IsEnum(Sistema)
  sistema?: Sistema;

  @IsOptional()
  @IsString()
  sueldoBasico?: string; // Decimal

  @IsOptional()
  @IsString()
  cupo?: string; // Decimal

  @IsOptional()
  @IsString()
  saldo?: string; // Decimal

  // --- Extras de flujo ---
  @IsOptional()
  @IsBoolean()
  crearCoseguro?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ColateralMinDto)
  colaterales?: ColateralMinDto[];
}
