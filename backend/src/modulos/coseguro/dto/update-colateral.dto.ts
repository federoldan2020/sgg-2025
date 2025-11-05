import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateColateralDto {
  @IsOptional() @IsNumber() parentescoId?: number;
  @IsOptional() @IsString() nombre?: string;
  @IsOptional()
  @IsString()
  dni?: string; // 👈 NUEVO
  @IsOptional() @IsDateString() fechaNacimiento?: string; // YYYY-MM-DD
  @IsOptional() @IsBoolean() activo?: boolean;
}
