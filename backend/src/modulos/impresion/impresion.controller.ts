// src/modulos/impresion/impresion.controller.ts
import { Body, Controller, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ImpresionService, type ImprimirComprobanteDto } from './impresion.service';

type ReqOrg = Request & { organizacionId?: string };

@Controller('print')
export class ImpresionController {
  constructor(private readonly svc: ImpresionService) {}

  // POST /print/comprobantes?disposition=inline|attachment
  @Post('comprobantes')
  async imprimir(
    @Req() req: ReqOrg,
    @Res() res: Response,
    @Query('disposition') disposition: 'inline' | 'attachment' = 'inline',
    @Body() body: ImprimirComprobanteDto,
  ) {
    const org =
      req.organizacionId ||
      (req.headers['x-org-id'] as string) ||
      (req.query['organizacionId'] as string);

    if (!org) throw new Error('Falta organización');

    const { buffer, filename } = await this.svc.render(org, body);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.end(buffer);
  }
}
