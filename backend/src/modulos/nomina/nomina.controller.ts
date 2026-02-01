// src/modulos/nomina/nomina.controller.ts
import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NominaService } from './nomina.service';
import { AuditService } from '../../common/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';

type ReqOrg = Request & { organizacionId?: string; ip?: string; headers?: Record<string, string> };

@Controller('nomina')
export class NominaController {
  constructor(
    private readonly svc: NominaService,
    private readonly audit: AuditService,
  ) {}

  @Post('preview')
  async preview(
    @Req() req: ReqOrg,
    @Body()
    dto: {
      periodo: string;
      archivoNombre?: string;
      hash?: string;
      items: Array<{
        afiliadoId?: number;
        dni?: number;
        padronId?: number;
        codigo: string;
        monto: number;
      }>;
    },
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.preview(org, dto);
  }

  @Post('confirmar/:loteId')
  async confirmar(
    @Req() req: ReqOrg,
    @Param('loteId') loteId: string,
    @CurrentUser() user: Usuario,
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    const result = await this.svc.confirmar(org, Number(loteId));
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId: org,
      accion: 'NOMINA_CONFIRMAR',
      entidad: 'LoteNomina',
      entidadId: loteId,
      payloadDespues: { loteId },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }
}
