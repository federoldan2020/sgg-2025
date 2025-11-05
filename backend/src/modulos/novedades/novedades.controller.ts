import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UsePipes,
  ValidationPipe,
  Param,
  Body,
  Patch,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { NovedadesService } from './novedades.service';

@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('novedades')
export class NovedadesController {
  constructor(private readonly svc: NovedadesService) {}

  // ===================== MONITOR (NUEVO) =====================

  /**
   * GET /novedades?from=YYYY-MM-DD&to=YYYY-MM-DD&tipo=J17,J22,J38&accion=alta|baja|modif&q=texto&page=1&limit=20&sort=ocurridoEn:desc
   */
  @Get()
  async listarPendientes(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tipo') tipoCsv?: string,
    @Query('accion') accion?: 'alta' | 'baja' | 'modif' | '',
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    const organizacionId = req.organizacionId!;
    const tipos = (tipoCsv ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean) as ('J17' | 'J22' | 'J38')[];

    const p = Number.isFinite(Number(page)) ? Number(page) : 1;
    const l = Number.isFinite(Number(limit)) ? Number(limit) : 20;

    return this.svc.listarPendientes(organizacionId, {
      from,
      to,
      tipos,
      accion: (accion ?? '') as any,
      q,
      page: p,
      limit: l,
      sort,
    });
  }

  /**
   * GET /novedades/resumen?from=YYYY-MM-DD&to=YYYY-MM-DD&tipo=J17,J22,J38&accion=alta|baja|modif&q=texto
   */
  @Get('resumen')
  async resumenPendientes(
    @Req() req: Request,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('tipo') tipoCsv?: string,
    @Query('accion') accion?: 'alta' | 'baja' | 'modif' | '',
    @Query('q') q?: string,
  ) {
    const organizacionId = req.organizacionId!;
    const tipos = (tipoCsv ?? '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean) as ('J17' | 'J22' | 'J38')[];

    return this.svc.resumenPendientes(organizacionId, {
      from,
      to,
      tipos,
      accion: (accion ?? '') as any,
      q,
    });
  }

  // GET /novedades/pendientes/resumen
  @Get('pendientes/resumen')
  async listarPendientesResumen(
    @Req() req: Request,
    @Query('periodo') periodo?: string,
    @Query('sistema') sistema?: 'ES' | 'SG' | '',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    const organizacionId = req.organizacionId!;
    const p = Number.isFinite(Number(page)) ? Number(page) : 1;
    const l = Number.isFinite(Number(limit)) ? Number(limit) : 20;

    // 'await' para cumplir con @typescript-eslint/require-await
    return await this.svc.listarPendientesResumen(organizacionId, {
      periodo,
      sistema: (sistema as 'ES' | 'SG' | '') || undefined,
      page: p,
      limit: l,
      q,
    });
  }

  // GET /novedades/pendientes/resumen/:periodo/txt?sistema=ES|SG
  @Get('pendientes/resumen/:periodo/txt')
  async descargarTxtDesdeResumen(
    @Req() req: Request,
    @Param('periodo') periodo: string,
    @Query('sistema') sistema: 'ES' | 'SG',
    @Res() res: Response,
  ) {
    const organizacionId = req.organizacionId!;
    const { nombre, contenido } = await this.svc.construirTxtDesdeResumen(
      organizacionId,
      periodo,
      sistema,
    );

    res.setHeader('Content-Type', 'text/plain; charset=latin1');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(contenido);
  }

  // ===================== EXISTENTES =====================

  @Post('generar')
  async generar(
    @Req() req: Request,
    @Query('periodo') periodo: string,
    @Query('onDuplicate') onDuplicate?: 'error' | 'replace' | 'skip',
  ) {
    const organizacionId = req.organizacionId!;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      throw new Error('Periodo inválido (se espera YYYY-MM)');
    }
    const lote = await this.svc.generarLote(organizacionId, periodo, {
      onDuplicate: onDuplicate ?? 'error',
    });
    return { id: String(lote.id), periodo: lote.periodo, estado: lote.estado };
  }

  @Get('lote-txt')
  async descargarTxt(
    @Req() req: Request,
    @Res() res: Response,
    @Query('loteId') loteId: string,
    @Query('sistema') sistema: 'ES' | 'SG',
  ) {
    const organizacionId = req.organizacionId!;
    if (!loteId) throw new Error('loteId requerido');
    if (!['ES', 'SG'].includes(sistema)) throw new Error('sistema inválido (ES|SG)');

    const { nombre, contenido } = await this.svc.construirTxt(
      organizacionId,
      BigInt(loteId),
      sistema,
    );

    res.setHeader('Content-Type', 'text/plain; charset=latin1');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.status(200).send(contenido);
  }

  @Get('lote-preview')
  async preview(
    @Req() req: Request,
    @Query('loteId') loteId: string,
    @Query('sistema') sistema?: 'ES' | 'SG',
  ) {
    const organizacionId = req.organizacionId!;
    if (!loteId) throw new Error('loteId requerido');
    if (sistema && !['ES', 'SG'].includes(sistema)) {
      throw new Error('sistema inválido (ES|SG)');
    }
    return this.svc.previewLote(organizacionId, BigInt(loteId), { sistema });
  }

  /** GET /novedades/coseguro/precio-vigente?fecha=YYYY-MM-DD */
  @Get('coseguro/precio-vigente')
  async getPrecioCoseguroVigente(@Req() req: Request, @Query('fecha') fecha?: string) {
    const organizacionId = req.organizacionId!;
    const f = fecha ? new Date(`${fecha}T00:00:00.000Z`) : undefined;
    return this.svc.getPrecioCoseguroVigente(organizacionId, f);
  }

  /**
   * POST /novedades/coseguro/precio
   * body: { nuevoPrecio: number, vigenteDesde?: 'YYYY-MM-DD', impactarPadrones?: boolean, dedupe?: 'keep'|'replace' }
   */
  @Post('coseguro/precio')
  async actualizarPrecioCoseguro(
    @Req() req: Request,
    @Body()
    body: {
      nuevoPrecio: number | string;
      vigenteDesde?: string; // YYYY-MM-DD
      impactarPadrones?: boolean;
      dedupe?: 'keep' | 'replace';
    },
  ) {
    const organizacionId = req.organizacionId!;
    if (body.nuevoPrecio == null || isNaN(Number(body.nuevoPrecio))) {
      throw new Error('nuevoPrecio requerido y numérico');
    }
    const fecha = body.vigenteDesde ? new Date(`${body.vigenteDesde}T00:00:00.000Z`) : undefined;

    return this.svc.actualizarPrecioCoseguroGlobal({
      organizacionId,
      nuevoPrecio: body.nuevoPrecio,
      vigenteDesde: fecha,
      impactarPadrones: body.impactarPadrones ?? true,
      dedupe: body.dedupe ?? 'replace',
    });
  }

  /**
   * GET /novedades/corte?periodo=YYYY-MM
   * Devuelve { periodo, diaCorte } (o 10 si no hay fila)
   */
  @Get('corte')
  async getCorte(@Req() req: Request, @Query('periodo') periodo?: string) {
    const organizacionId = req.organizacionId!;
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const per =
      periodo && /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)
        ? periodo
        : `${today.getUTCFullYear()}-${pad(today.getUTCMonth() + 1)}`;

    // await para satisfacer eslint require-await
    const data = await this.svc.getCortePeriodo(organizacionId, per);
    return data;
  }

  /**
   * PATCH /novedades/corte
   * Body: { periodo: "YYYY-MM", diaCorte: number }
   */
  @Patch('corte')
  async setCorte(@Req() req: Request, @Body() body: { periodo: string; diaCorte: number }) {
    const organizacionId = req.organizacionId!;
    const { periodo, diaCorte } = body;
    const data = await this.svc.setCortePeriodo(organizacionId, periodo, diaCorte);
    return data;
  }

  /**
   * GET /novedades/corte/resolve?fecha=YYYY-MM-DD
   * Para pruebas: responde el periodo destino que se aplicaría a esa fecha con el corte actual
   */
  @Get('corte/resolve')
  async resolverPorFecha(@Req() req: Request, @Query('fecha') fecha?: string) {
    const organizacionId = req.organizacionId!;
    if (!fecha) throw new Error('fecha requerida (YYYY-MM-DD)');
    const data = await this.svc.resolverPeriodoPorFecha(organizacionId, fecha);
    return data;
  }
}
