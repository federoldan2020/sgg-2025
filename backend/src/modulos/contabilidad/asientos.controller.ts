// src/modulos/contabilidad/asientos.controller.ts
import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ContabilidadService } from './contabilidad.service';

type ReqOrg = Request & { organizacionId?: string };

@Controller('contabilidad/asientos')
export class AsientosController {
  constructor(private readonly svc: ContabilidadService) {}

  @Get()
  async listar(
    @Req() req: ReqOrg,
    @Query()
    q: {
      desde?: string;
      hasta?: string;
      origen?: string;
      q?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    return this.svc.listarAsientos(org, {
      desde: q.desde ?? null,
      hasta: q.hasta ?? null,
      origen: q.origen ?? null,
      q: q.q ?? null,
      page: q.page ? Number(q.page) : 1,
      pageSize: q.pageSize ? Number(q.pageSize) : 20,
    });
  }

  @Get(':id')
  async detalle(@Req() req: ReqOrg, @Param('id') id: string) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.obtenerAsiento(org, BigInt(id));
  }

  // Export CSV (usa mismos filtros del listado)
  @Get('export/csv')
  async exportCsv(
    @Req() req: ReqOrg,
    @Res() res: Response,
    @Query() q: { desde?: string; hasta?: string; origen?: string; q?: string },
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    const data = await this.svc.listarAsientos(org, {
      desde: q.desde ?? null,
      hasta: q.hasta ?? null,
      origen: q.origen ?? null,
      q: q.q ?? null,
      page: 1,
      pageSize: 1000, // límite razonable para export
    });

    const csv = this.svc.buildAsientosCSV(data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="asientos.csv"');
    res.send(csv);
  }
}
