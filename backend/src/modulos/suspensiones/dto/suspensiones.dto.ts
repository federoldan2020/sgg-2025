import { IsBoolean, IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';

export class CrearParametroDto {
  @IsNumber()
  @Min(0)
  valor!: number;

  @IsDateString()
  vigenteDesde!: string;
}

export class CrearExcepcionDto {
  @IsString()
  @IsNotEmpty()
  motivo!: string;

  @IsOptional()
  @IsDateString()
  vigenciaHasta?: string;
}

export class CalcularCoberturaDto {
  @IsString()
  @Length(7, 7)
  periodo!: string; // YYYY-MM
}

export class CierreMensualDto {
  @IsString()
  @Length(7, 7)
  periodo!: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class MaterializarMensualDto {
  @IsString()
  @Length(7, 7)
  periodo!: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class RehabilitarDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}

export class SuspenderManualDto {
  @IsString()
  @Length(7, 7)
  periodoOrigen!: string;

  @IsOptional()
  @IsString()
  observacion?: string;
}

export class RevertirSuspensionDto {
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}

export class AfiliadoIdParamDto {
  @IsInt()
  afiliadoId!: number;
}
