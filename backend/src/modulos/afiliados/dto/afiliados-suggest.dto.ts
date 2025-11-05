import { IsString, Length } from 'class-validator';

export class AfiliadosSuggestQueryDto {
  @IsString()
  @Length(1, 80)
  q!: string;

  // opcional: límite (string numérica, transform la convierte)
  // podés agregar @IsNumberString() si querés validar
}
