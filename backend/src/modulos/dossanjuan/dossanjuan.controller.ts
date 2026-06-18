import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { DossanjuanSyncService } from './dossanjuan-sync.service';
import { DossanjuanService } from './dossanjuan.service';

type ReqOrg = Request & { organizacionId?: string };
function reqOrg(req: ReqOrg): string {
  if (!req.organizacionId) throw new BadRequestException('Falta organización');
  return req.organizacionId;
}

@Controller('integraciones/dossanjuan')
export class DossanjuanController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: DossanjuanSyncService,
    private readonly ds: DossanjuanService,
  ) {}

  /** Listado de la cola para monitoreo. */
  @Get('cola')
  async cola(
    @Req() req: ReqOrg,
    @Query('estado') estado?: 'PENDIENTE' | 'OK' | 'ERROR_PERMANENTE',
    @Query('limit') limit = '50',
  ) {
    const organizacionId = reqOrg(req);
    const take = Math.min(200, Math.max(1, Number(limit) || 50));
    const rows = await this.prisma.syncDossanjuan.findMany({
      where: {
        organizacionId,
        ...(estado ? { estado } : {}),
      },
      orderBy: { creadoEn: 'desc' },
      take,
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      coseguroId: r.coseguroId?.toString() ?? null,
      dni: r.dni.toString(),
      accion: r.accion,
      estado: r.estado,
      intentos: r.intentos,
      ultimoError: r.ultimoError,
      respuestaWs: r.respuestaWs?.slice(0, 200) ?? null,
      ejecutadoEn: r.ejecutadoEn?.toISOString() ?? null,
      creadoEn: r.creadoEn.toISOString(),
    }));
  }

  /** Test de conectividad: busca un DNI en el WS. */
  @Get('buscar/:dni')
  buscar(@Param('dni') dni: string) {
    if (!/^\d{6,12}$/.test(dni.trim())) {
      throw new BadRequestException('DNI inválido');
    }
    return this.ds.buscarPersona(dni.trim());
  }

  /** Forzar un tick del worker (útil para debug). */
  @Post('procesar')
  async procesar() {
    await this.sync.procesarPendientesAhora();
    return { ok: true };
  }
}
