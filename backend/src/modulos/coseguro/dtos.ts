import { IsString, IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';

export interface ConfigurarCoseguroDto {
  afiliadoId: number;
  imputacionPadronIdCoseguro?: number;
  imputacionPadronIdColaterales?: number;
  fechaAlta?: string; // yyyy-mm-dd; default: hoy
}

export interface AltaColateralesDto {
  afiliadoId: number | string; // acepta "123" o 123
  items: {
    parentescoCodigo: number | string; // acepta 2 o "HIJO" o "2"
    nombre: string;
    fechaNacimiento?: string;
  }[];
}
export interface ResumenCoseguroQuery {
  fecha?: string; // yyyy-mm-dd (usa hoy si no viene)
}

export interface GenerarObligacionesDto {
  afiliadoId: number;
  periodo: string; // 'YYYY-MM'
}

export interface ResumenCoseguroResp {
  afiliadoId: string;
  fechaCorte: string;
  precioBase: string; // decimal string
  colaterales: {
    parentescoCodigo: string;
    cantidad: number;
    precioTotal: string; // por grupo de parentesco
  }[];
  totalCoseguro: string; // = precioBase
  totalColaterales: string; // suma de grupos
  total: string; // suma total
  imputaciones: {
    padronCoseguroId?: string;
    padronColateralesId?: string;
  };
}

export class CreateReglaJ22Dto {
  @IsString() vigenteDesde!: string; // YYYY-MM-DD
  @IsOptional() @IsString() vigenteHasta?: string | null;
  @IsNumber() @Min(0) precioBase!: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class UpdateReglaJ22Dto {
  @IsOptional() @IsString() vigenteDesde?: string;
  @IsOptional() @IsString() vigenteHasta?: string | null;
  @IsOptional() @IsNumber() @Min(0) precioBase?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class ToggleDto {
  @IsBoolean() activo!: boolean;
}
