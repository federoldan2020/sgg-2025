// src/modulos/publicaciones/dtos.ts
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CrearPublicacionDto {
  @IsOptional() @IsString() comentario?: string;
}

export class DraftColateralDto {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  @IsEnum(['create', 'update', 'delete'] as any) op!: 'create' | 'update' | 'delete';

  // Para update/delete
  @IsOptional() @IsString() targetId?: string;

  // Para create/update (parciales válidos en update)
  /** Opcional: null/omitido = regla comodín (aplica a cualquier parentesco). */
  @IsOptional() @IsString() parentescoId?: string | null;
  @IsOptional() @IsString() cantidadDesde?: string;
  @IsOptional() @IsString() cantidadHasta?: string | null;
  @IsOptional() @IsString() vigenteDesde?: string;
  @IsOptional() @IsString() vigenteHasta?: string | null;
  /** Precio por cabeza (nuevo modelo). Exactamente uno de los dos por draft. */
  @IsOptional() @IsString() precioPorColateral?: string;
  /** Precio total fijo del tramo (semántica histórica). */
  @IsOptional() @IsString() precioTotal?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class PublicarDto {
  @IsOptional() @IsString() comentario?: string;
}

export type DryRunResumen = {
  parentescosAfectados: Array<{ parentescoId: string; codigo?: number }>;
  reglasImpactadas: number;
  aseguradosAfectados: number;
  estimacionAjustes: number; // opcional
};
