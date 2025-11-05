import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateColateralDto {
  @IsNumber()
  parentescoId!: number; // FK a Parentesco

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsOptional()
  @IsString()
  dni?: string; // 👈 NUEVO

  @IsOptional()
  @IsDateString()
  fechaNacimiento?: string; // YYYY-MM-DD

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
