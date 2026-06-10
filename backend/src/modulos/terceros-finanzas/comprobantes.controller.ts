import { Body, Controller, Get, Param, Post, Query, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import { ComprobantesService } from './comprobantes.service';
import type { CrearComprobanteDTO } from './comprobantes.dto';
import { ListarComprobantesQueryDto } from './dto/listar-comprobantes-query.dto';
import { RolTercero } from '@prisma/client';
import { clampPageLimit } from '../../common/sanitize';
import { sanitizeSearchTerm } from '../../common/sanitize';

type ReqOrg = Request & { organizacionId?: string };

@Controller('terceros/comprobantes')
export class ComprobantesController {
  constructor(private svc: ComprobantesService) {}

  @Post()
  crear(@Body() dto: CrearComprobanteDTO) {
    return this.svc.crear(dto);
  }

  @Post(':id/anular')
  anular(@Param('id') id: string, @Body('organizacionId') org: string) {
    return this.svc.anular(org, BigInt(id));
  }

  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  listar(@Req() req: ReqOrg, @Query() q: ListarComprobantesQueryDto) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.listar(org, {
      rol: q.rol,
      estado: q.estado,
      q: q.q ? sanitizeSearchTerm(q.q) : null,
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? clampPageLimit(Number(q.pageSize)) : undefined,
    });
  }

  @Get('pendientes')
  async pendientes(
    @Req() req: ReqOrg,
    @Query('terceroId') terceroId: string,
    @Query('rol') rol: RolTercero,
    @Query('limit') limit?: string,
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    if (!terceroId) throw new Error('terceroId requerido');
    if (!rol) throw new Error('rol requerido');

    const terceroIdBig = BigInt(String(terceroId));
    const limitNum = clampPageLimit(limit ? Number(limit) : 50);

    return this.svc.pendientesPorTercero(org, {
      terceroId: terceroIdBig,
      rol,
      limit: limitNum,
    });
  }
}
