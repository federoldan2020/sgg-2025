// src/modulos/contabilidad/cuentas.controller.ts
import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ContabilidadService } from './contabilidad.service';

type ReqOrg = Request & { organizacionId?: string };

@Controller('contabilidad/cuentas')
export class CuentasController {
  constructor(private readonly svc: ContabilidadService) {}

  @Get('buscar')
  async buscar(
    @Req() req: ReqOrg,
    @Query() query: { q: string; imputableOnly?: string; limit?: string },
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    const q = (query.q ?? '').trim();
    if (!q) return [];

    const imputableOnly = query.imputableOnly === 'true';
    const limit = query.limit ? Number(query.limit) : 20;

    return this.svc.buscarCuentas({ organizacionId: org, q, imputableOnly, limit });
  }
}
