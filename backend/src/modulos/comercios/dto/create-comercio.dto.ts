import { IsBoolean, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateComercioDto {
  @IsString() organizacionId!: string;
  @IsString() codigo!: string;
  @IsString() razonSocial!: string;

  @IsOptional() @IsString() domicilio?: string;
  @IsOptional() @IsString() localidad?: string;
  @IsOptional() @IsString() fechaIngreso?: string; // ISO
  @IsOptional() @IsString() telefono1?: string;
  @IsOptional() @IsString() telefono2?: string;
  @IsOptional() @IsString() email?: string;

  @IsOptional() @IsInt() grupo?: number;
  @IsOptional() @IsInt() departamento?: number;
  @IsOptional() @IsInt() rubro?: number;
  @IsOptional() @IsInt() tipo?: number;

  @IsOptional() @IsInt() cuoMax?: number;

  @IsOptional() @IsNumber() pIVA?: number;
  @IsOptional() @IsNumber() pGanancia?: number;
  @IsOptional() @IsNumber() pIngresosBrutos?: number;
  @IsOptional() @IsNumber() pLoteHogar?: number;
  @IsOptional() @IsNumber() pRetencion?: number;

  @IsOptional() @IsString() cuit?: string;
  @IsOptional() @IsString() iibb?: string;

  @IsOptional() @IsBoolean() usoContable?: boolean;
  @IsOptional() @IsBoolean() baja?: boolean;
  @IsOptional() @IsBoolean() confirma?: boolean;

  @IsOptional() @IsNumber() saldoActual?: number;
}
