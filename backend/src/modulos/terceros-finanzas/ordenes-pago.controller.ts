// src/modulos/terceros-finanzas/ordenes-pago.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { OrdenesPagoService } from './ordenes-pago.service';
import type { CrearOrdenPagoDTO } from './ordenes-pago.dto';
import { RolTercero, EstadoOrdenPago } from '@prisma/client';

@Controller('terceros/ordenes-pago')
export class OrdenesPagoController {
  constructor(private svc: OrdenesPagoService) {}

  @Post()
  async crear(@Body() dto: CrearOrdenPagoDTO) {
    if (!dto?.organizacionId) throw new Error('Falta organización');
    return this.svc.crear(dto);
  }

  @Get()
  async listar(
    @Query('organizacionId') org: string,
    @Query('rol') rol?: RolTercero,
    @Query('estado') estado?: EstadoOrdenPago,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (!org) throw new Error('Falta organización');
    return this.svc.listar(org, {
      rol,
      estado,
      q: q ?? null,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
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
