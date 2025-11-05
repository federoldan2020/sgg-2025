import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateReglaColateralDto {
  @IsInt() @Min(1) parentescoId!: number; // 👈 ahora por ID
  @IsInt() @Min(1) cantidadDesde!: number;
  @IsOptional() @IsInt() @Min(1) cantidadHasta?: number | null;
  @IsString() vigenteDesde!: string; // YYYY-MM-DD
  @IsOptional() @IsString() vigenteHasta?: string | null;
  @IsNumber() @Min(0) precioTotal!: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class UpdateReglaColateralDto {
  @IsOptional() @IsInt() @Min(1) parentescoId?: number;
  @IsOptional() @IsInt() @Min(1) cantidadDesde?: number;
  @IsOptional() @IsInt() @Min(1) cantidadHasta?: number | null;
  @IsOptional() @IsString() vigenteDesde?: string;
  @IsOptional() @IsString() vigenteHasta?: string | null;
  @IsOptional() @IsNumber() @Min(0) precioTotal?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class ToggleDto {
  @IsBoolean() activo!: boolean;
}
