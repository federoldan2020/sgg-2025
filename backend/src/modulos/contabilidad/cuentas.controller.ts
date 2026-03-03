// src/modulos/contabilidad/cuentas.controller.ts
import { Controller, Get, Query, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Request } from 'express';
import { ContabilidadService } from './contabilidad.service';
import { BuscarCuentasQueryDto } from './dto/buscar-cuentas-query.dto';
import { clampPageLimit } from '../../common/sanitize';

type ReqOrg = Request & { organizacionId?: string };

@Controller('contabilidad/cuentas')
export class CuentasController {
  constructor(private readonly svc: ContabilidadService) {}

  @Get('buscar')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async buscar(@Req() req: ReqOrg, @Query() query: BuscarCuentasQueryDto) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    const q = (query.q ?? '').trim();
    if (!q) return [];

    const imputableOnly = query.imputableOnly === 'true';
    const limit = clampPageLimit(query.limit ? Number(query.limit) : 20);

    return this.svc.buscarCuentas({ organizacionId: org, q, imputableOnly, limit });
  }
}
