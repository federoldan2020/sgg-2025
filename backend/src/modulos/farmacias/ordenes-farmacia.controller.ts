import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { OrdenesFarmaciaService } from './ordenes-farmacia.service';
import { AnularConsumoDto } from './dtos';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';

type ReqOrg = Request & { organizacionId?: string };
function reqOrg(req: ReqOrg): string {
  if (!req.organizacionId) throw new Error('Falta organización');
  return req.organizacionId;
}

@Controller('coseguro/afiliados')
export class OrdenesFarmaciaAdminController {
  constructor(private readonly svc: OrdenesFarmaciaService) {}

  /** Saldo del titular para un mes (default: mes corriente). */
  @Get(':afiliadoId/ordenes/saldo')
  saldo(
    @Req() req: ReqOrg,
    @Param('afiliadoId') afiliadoId: string,
    @Query('periodo') periodo?: string,
  ) {
    return this.svc.getSaldo(reqOrg(req), afiliadoId, periodo);
  }

  /** Consumos del titular para un mes. */
  @Get(':afiliadoId/ordenes')
  consumos(
    @Req() req: ReqOrg,
    @Param('afiliadoId') afiliadoId: string,
    @Query('periodo') periodo?: string,
  ) {
    return this.svc.listarConsumos(reqOrg(req), afiliadoId, periodo);
  }

  /** Anular consumo desde el admin (operario del gremio). */
  @Post('ordenes/:consumoId/anular')
  anular(
    @Req() req: ReqOrg,
    @Param('consumoId') consumoId: string,
    @Body() dto: AnularConsumoDto,
    @CurrentUser('id') usuarioId: bigint,
  ) {
    return this.svc.anular({
      organizacionId: reqOrg(req),
      consumoId,
      motivo: dto.motivo,
      actorLabel: `usuario:${usuarioId.toString()}`,
    });
  }
}
