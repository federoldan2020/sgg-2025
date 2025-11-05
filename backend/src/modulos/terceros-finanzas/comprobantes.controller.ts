import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express'; // 👈 agrega esto
import { ComprobantesService } from './comprobantes.service';
import type { CrearComprobanteDTO } from './comprobantes.dto';
import { RolTercero, EstadoComprobanteTercero } from '@prisma/client'; // 👈 tipa rol/estado

type ReqOrg = Request & { organizacionId?: string }; // 👈 agrega esto

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
  listar(
    @Query('organizacionId') org: string,
    @Query('rol') rol?: RolTercero, // 👈 usa enum
    @Query('estado') estado?: EstadoComprobanteTercero, // 👈 usa enum
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.listar(org, {
      rol,
      estado,
      q: q ?? null,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  // GET /terceros/comprobantes/pendientes?terceroId=...&rol=PROVEEDOR&limit=50
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

    // 👇 evita el warning de no-unsafe-argument
    const terceroIdBig = BigInt(String(terceroId));

    return this.svc.pendientesPorTercero(org, {
      terceroId: terceroIdBig,
      rol,
      limit: limit ? Number(limit) : 50,
    });
  }
}
