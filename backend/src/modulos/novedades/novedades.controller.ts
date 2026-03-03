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
  Delete,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import type { Request, Response } from 'express';
import { NovedadesService } from './novedades.service';
import { clampPageLimit, sanitizeSearchTerm } from '../../common/sanitize';

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

    const p = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;
    const l = clampPageLimit(Number.isFinite(Number(limit)) ? Number(limit) : 20);

    return this.svc.listarPendientes(organizacionId, {
      from,
      to,
      tipos,
      accion: (accion ?? '') as any,
      q: q ? sanitizeSearchTerm(q) : undefined,
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
      q: q ? sanitizeSearchTerm(q) : undefined,
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
    const p = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;
    const l = clampPageLimit(Number.isFinite(Number(limit)) ? Number(limit) : 20);

    return await this.svc.listarPendientesResumen(organizacionId, {
      periodo,
      sistema: (sistema as 'ES' | 'SG' | '') || undefined,
      page: p,
      limit: l,
      q: q ? sanitizeSearchTerm(q) : undefined,
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

  // ===================== GENERACIÓN DE NOVEDADES =====================

  /**
   * POST /novedades/generar
   * Genera novedades automáticamente desde pendientes y manuales para un período/sistema
   * Query: periodo=YYYY-MM&sistema=ES|SG&generadoPor=usuario&onDuplicate=error|replace
   */
  @Post('generar')
  async generarNovedades(
    @Req() req: Request,
    @Query('periodo') periodo: string,
    @Query('sistema') sistema: 'ES' | 'SG',
    @Query('generadoPor') generadoPor?: string,
    @Query('onDuplicate') onDuplicate?: 'error' | 'replace',
  ) {
    const organizacionId = req.organizacionId!;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      throw new Error('Periodo inválido (se espera YYYY-MM)');
    }
    if (!['ES', 'SG'].includes(sistema)) {
      throw new Error('Sistema inválido (ES|SG)');
    }

    return this.svc.generarNovedades(organizacionId, periodo, sistema, {
      generadoPor,
      onDuplicate: onDuplicate ?? 'error',
    });
  }

  /**
   * GET /novedades/generadas
   * Lista las generaciones de novedades
   * Query: periodo=YYYY-MM&sistema=ES|SG&page=1&limit=20
   */
  @Get('generadas')
  async listarNovedadesGeneradas(
    @Req() req: Request,
    @Query('periodo') periodo?: string,
    @Query('sistema') sistema?: 'ES' | 'SG' | '',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const organizacionId = req.organizacionId!;
    const p = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;
    const l = clampPageLimit(Number.isFinite(Number(limit)) ? Number(limit) : 20);

    return this.svc.listarNovedadesGeneradas(organizacionId, {
      periodo,
      sistema: (sistema as 'ES' | 'SG' | '') || undefined,
      page: p,
      limit: l,
    });
  }

  /**
   * GET /novedades/generadas/:id/txt
   * Descarga el TXT de una generación de novedades
   */
  @Get('generadas/:id/txt')
  async descargarTxtGenerado(
    @Req() req: Request,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const organizacionId = req.organizacionId!;
    if (!id) throw new Error('id requerido');

    const { nombre, contenido } = await this.svc.descargarTxtGenerado(
      organizacionId,
      BigInt(id),
    );

    res.setHeader('Content-Type', 'text/plain; charset=latin1');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.status(200).send(contenido);
  }

  /**
   * DELETE /novedades/generadas/:id
   * Elimina una generación de novedades
   */
  @Delete('generadas/:id')
  async eliminarNovedadGenerada(@Req() req: Request, @Param('id') id: string) {
    const organizacionId = req.organizacionId!;
    if (!id) throw new Error('id requerido');

    return this.svc.eliminarNovedadGenerada(organizacionId, BigInt(id));
  }

  // ===================== NOVEDADES MANUALES =====================

  /**
   * GET /novedades/manuales
   * Lista las novedades manuales
   * Query: periodo=YYYY-MM&codigo=P40&q=texto&page=1&limit=20
   */
  @Get('manuales')
  async listarNovedadesManuales(
    @Req() req: Request,
    @Query('periodo') periodo?: string,
    @Query('codigo') codigo?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const organizacionId = req.organizacionId!;
    const p = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;
    const l = clampPageLimit(Number.isFinite(Number(limit)) ? Number(limit) : 20);

    return this.svc.listarNovedadesManuales(organizacionId, {
      periodo,
      codigo,
      q: q ? sanitizeSearchTerm(q) : undefined,
      page: p,
      limit: l,
    });
  }

  /**
   * POST /novedades/manuales
   * Crea una novedad manual
   * Body: { periodo, afiliadoId, padronId?, padronRaw, centro?, codigo, importe, observacion?, creadoPor? }
   */
  @Post('manuales')
  async crearNovedadManual(
    @Req() req: Request,
    @Body()
    body: {
      periodo: string;
      afiliadoId: number | string;
      padronId?: number | string | null;
      padronRaw: string;
      centro?: number | null;
      codigo: string;
      importe: number | string;
      observacion?: string | null;
      creadoPor?: string | null;
    },
  ) {
    const organizacionId = req.organizacionId!;
    const afiliadoId = typeof body.afiliadoId === 'string' ? Number(body.afiliadoId) : body.afiliadoId;
    const padronId =
      body.padronId != null ? (typeof body.padronId === 'string' ? Number(body.padronId) : body.padronId) : null;
    return this.svc.crearNovedadManual({
      organizacionId,
      periodo: body.periodo,
      afiliadoId,
      padronId,
      padronRaw: body.padronRaw,
      centro: body.centro,
      codigo: body.codigo,
      importe: body.importe,
      observacion: body.observacion,
      creadoPor: body.creadoPor,
    });
  }

  /**
   * PATCH /novedades/manuales/:id
   * Actualiza una novedad manual
   * Body: { padronId?, padronRaw?, centro?, codigo?, importe?, observacion? }
   */
  @Patch('manuales/:id')
  async actualizarNovedadManual(
    @Req() req: Request,
    @Param('id') id: string,
    @Body()
    body: {
      padronId?: number | string | null;
      padronRaw?: string;
      centro?: number | null;
      codigo?: string;
      importe?: number | string;
      observacion?: string | null;
    },
  ) {
    const organizacionId = req.organizacionId!;
    if (!id) throw new Error('id requerido');

    const padronId =
      body.padronId != null ? (typeof body.padronId === 'string' ? Number(body.padronId) : body.padronId) : undefined;
    return this.svc.actualizarNovedadManual(organizacionId, BigInt(id), {
      padronId,
      padronRaw: body.padronRaw,
      centro: body.centro,
      codigo: body.codigo,
      importe: body.importe,
      observacion: body.observacion,
    });
  }

  /**
   * DELETE /novedades/manuales/:id
   * Elimina una novedad manual
   */
  @Delete('manuales/:id')
  async eliminarNovedadManual(@Req() req: Request, @Param('id') id: string) {
    const organizacionId = req.organizacionId!;
    if (!id) throw new Error('id requerido');

    return this.svc.eliminarNovedadManual(organizacionId, BigInt(id));
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

  // ===================== CONCILIACIÓN DE NOVEDADES =====================

  /**
   * POST /novedades/conciliar
   * Sube un archivo TXT de conciliación de cómputos y procesa los montos efectivamente descontados
   * Query: periodo=YYYY-MM (opcional, si no se proporciona se extrae del archivo)
   * Response: Streaming con Server-Sent Events para progreso en tiempo real
   */
  @Post('conciliar')
  @UseInterceptors(FileInterceptor('file'))
  async procesarConciliacion(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
    @UploadedFile() file: Express.Multer.File,
    @Query('periodo') periodo?: string,
  ) {
    const organizacionId = req.organizacionId!;
    if (!file) {
      throw new BadRequestException('Archivo requerido');
    }

    const buf = file.buffer;
    if (!buf || buf.length === 0) {
      throw new BadRequestException('Archivo vacío');
    }

    // Configurar Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Deshabilitar buffering en nginx

    const enviarEvento = (evento: string, datos: any) => {
      res.write(`event: ${evento}\n`);
      res.write(`data: ${JSON.stringify(datos)}\n\n`);
    };

    try {
      const resultado = await this.svc.procesarConciliacionConProgreso(
        organizacionId,
        buf,
        periodo,
        (progreso) => {
          enviarEvento('progreso', progreso);
          // Forzar flush para que el navegador reciba los eventos inmediatamente
          if (res.flushHeaders) {
            res.flushHeaders();
          }
        },
      );

      enviarEvento('completado', resultado);
      res.end();
    } catch (error) {
      enviarEvento('error', {
        mensaje: error instanceof Error ? error.message : 'Error desconocido',
      });
      res.end();
    }
  }
}
