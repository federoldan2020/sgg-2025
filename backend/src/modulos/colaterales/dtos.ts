import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateReglaColateralDto {
  /** null/omitido = regla comodín (aplica a cualquier parentesco). */
  @IsOptional() @IsInt() @Min(1) parentescoId?: number | null;
  @IsInt() @Min(1) cantidadDesde!: number;
  @IsOptional() @IsInt() @Min(1) cantidadHasta?: number | null;
  @IsString() vigenteDesde!: string; // YYYY-MM-DD
  @IsOptional() @IsString() vigenteHasta?: string | null;
  /** Precio por cada colateral en el tramo (nuevo modelo). */
  @IsOptional() @IsNumber() @Min(0) precioPorColateral?: number;
  /** Precio total fijo del tramo (semántica histórica). */
  @IsOptional() @IsNumber() @Min(0) precioTotal?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class UpdateReglaColateralDto {
  @IsOptional() @IsInt() @Min(1) parentescoId?: number | null;
  @IsOptional() @IsInt() @Min(1) cantidadDesde?: number;
  @IsOptional() @IsInt() @Min(1) cantidadHasta?: number | null;
  @IsOptional() @IsString() vigenteDesde?: string;
  @IsOptional() @IsString() vigenteHasta?: string | null;
  @IsOptional() @IsNumber() @Min(0) precioPorColateral?: number | null;
  @IsOptional() @IsNumber() @Min(0) precioTotal?: number | null;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class ToggleDto {
  @IsBoolean() activo!: boolean;
}
