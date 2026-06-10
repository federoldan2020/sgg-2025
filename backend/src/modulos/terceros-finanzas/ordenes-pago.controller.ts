// src/modulos/terceros-finanzas/ordenes-pago.controller.ts
import { Body, Controller, Get, Param, Post, Query, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import { OrdenesPagoService } from './ordenes-pago.service';
import type { CrearOrdenPagoDTO } from './ordenes-pago.dto';
import { ListarOrdenesPagoQueryDto } from './dto/listar-ordenes-query.dto';
import { clampPageLimit } from '../../common/sanitize';
import { sanitizeSearchTerm } from '../../common/sanitize';

type ReqOrg = Request & { organizacionId?: string };

@Controller('terceros/ordenes-pago')
export class OrdenesPagoController {
  constructor(private svc: OrdenesPagoService) {}

  @Post()
  async crear(@Body() dto: CrearOrdenPagoDTO) {
    if (!dto?.organizacionId) throw new Error('Falta organización');
    return this.svc.crear(dto);
  }

  @Get()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async listar(@Req() req: ReqOrg, @Query() q: ListarOrdenesPagoQueryDto) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.listar(org, {
      rol: q.rol,
      estado: q.estado,
      q: q.q ? sanitizeSearchTerm(q.q) : null,
      page: q.page ? Math.max(1, Number(q.page)) : undefined,
      pageSize: q.pageSize ? clampPageLimit(Number(q.pageSize)) : undefined,
    });
  }

  // POST /terceros/ordenes-pago/:id/anular  { organizacionId }
  @Post(':id/anular')
  async anular(@Param('id') id: string, @Body('organizacionId') org: string) {
    if (!org) throw new Error('Falta organización');
    const ordenId = BigInt(id);
    return this.svc.anular(org, ordenId);
  }
}
