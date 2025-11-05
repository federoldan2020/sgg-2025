import { IsBoolean, IsOptional } from 'class-validator';
import { PreviewOrdenCreditoDto } from './preview-orden-credito.dto';

export class CrearOrdenCreditoDto extends PreviewOrdenCreditoDto {
  /** Si no lo envías, se setea automáticamente en true si cantidadCuotas > 1 */
  @IsOptional()
  @IsBoolean()
  enCuotas?: boolean;
}
