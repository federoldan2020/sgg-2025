// src/modulos/nomina/nomina.controller.ts
import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NominaService } from './nomina.service';

type ReqOrg = Request & { organizacionId?: string };

@Controller('nomina')
export class NominaController {
  constructor(private readonly svc: NominaService) {}

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
  async confirmar(@Req() req: ReqOrg, @Param('loteId') loteId: string) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return this.svc.confirmar(org, Number(loteId));
  }
}
