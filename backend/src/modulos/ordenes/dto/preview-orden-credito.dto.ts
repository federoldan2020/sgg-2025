// src/modulos/ordenes/dto/preview-orden-credito.dto.ts
import { IsInt, IsNumber, IsString, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PreviewOrdenCreditoDto {
  @IsString()
  afiliadoId!: string;

  @IsString()
  padronId!: string;

  @IsString()
  comercioId!: string;

  // Permite "12,34" -> 12.34
  @Transform(({ value }) =>
    typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value),
  )
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  monto!: number;

  @Transform(({ value }) => Number(value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cuotas!: number;
}
