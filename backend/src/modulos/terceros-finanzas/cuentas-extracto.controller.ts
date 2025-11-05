// src/modulos/terceros-finanzas/cuentas-extracto.controller.ts
import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CuentasExtractoService } from './cuentas-extracto.service';
import { RolTercero } from '@prisma/client';

type ReqOrg = Request & { organizacionId?: string };

@Controller('cuentas-tercero')
export class CuentasExtractoController {
  constructor(private readonly svc: CuentasExtractoService) {}

  @Get('por-tercero')
  async porTercero(
    @Req() req: ReqOrg,
    @Query('terceroId') terceroId: string,
    @Query('rol') rol?: RolTercero,
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    if (!terceroId) throw new Error('Falta terceroId');

    return this.svc.listarCuentasDeTercero(org, BigInt(terceroId), rol ?? null);
  }

  @Get(':cuentaId/extracto')
  async extracto(
    @Req() req: ReqOrg,
    @Param('cuentaId') cuentaIdParam: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    const cuentaId = BigInt(cuentaIdParam);
    const parse = (s?: string) => (s ? new Date(`${s}T00:00:00`) : undefined);

    const d = parse(desde);
    const h = parse(hasta);
    const hastaEnd =
      h != null ? new Date(h.getFullYear(), h.getMonth(), h.getDate(), 23, 59, 59, 999) : undefined;

    // 👇 Usa el formato que el front espera
    return this.svc.extractoV2({
      organizacionId: org,
      cuentaId,
      desde: d ?? undefined,
      hasta: hastaEnd ?? undefined,
    });
  }
}
