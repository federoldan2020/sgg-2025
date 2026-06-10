import { Controller, Get, Param } from '@nestjs/common';
import { OrgId } from '../../common/decorators/org-id.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { CupoService } from './cupo.service';

@Controller('afiliados')
@Public()
export class CupoController {
  constructor(private readonly cupo: CupoService) {}

  /** GET /afiliados/:afiliadoId/cupo */
  @Get(':afiliadoId/cupo')
  async cupoDeAfiliado(
    @OrgId() orgId: string,
    @Param('afiliadoId') afiliadoId: string,
  ) {
    return this.cupo.calcular(orgId, BigInt(afiliadoId));
  }
}
