// src/modulos/impresion/comprobantes-impresos.controller.ts
import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ComprobantesImpresosService } from './comprobantes-impresos.service';

type ReqOrg = Request & { organizacionId?: string };

@Controller('comprobantes')
export class ComprobantesImpresosController {
  constructor(private readonly svc: ComprobantesImpresosService) {}

  // GET /comprobantes/:id/pdf?disposition=inline|attachment&organizacionId=...
  @Get(':id/pdf')
  async getPdf(
    @Req() req: ReqOrg,
    @Res() res: Response,
    @Param('id') id: string,
    @Query('disposition') disposition: 'inline' | 'attachment' = 'inline',
    @Query('organizacionId') orgFromQuery?: string,
  ) {
    let org: string | undefined =
      req.organizacionId ||
      (req.headers['x-organizacion-id'] as string) ||
      (req.headers['x-org-id'] as string) ||
      orgFromQuery;

    // fallback opcional a DB (dev)
    if (!org && process.env.ALLOW_ORG_FALLBACK === 'true') {
      const maybeOrg = await this.svc.resolveOrgFor(id); // Promise<string | null>
      if (maybeOrg) org = maybeOrg; // <-- narrow a string (no null)
    }

    if (!org) {
      res.status(400).json({
        error: 'Falta organización',
        hint: 'Pasá X-Organizacion-ID en headers o ?organizacionId=... en la URL (recomendado para window.open).',
      });
      return;
    }

    try {
      const { buffer, filename } = await this.svc.getPdf(org, id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
      res.end(buffer);
    } catch (e: any) {
      res.status(404).json({ message: e?.message ?? 'No encontrado' });
    }
  }
}
