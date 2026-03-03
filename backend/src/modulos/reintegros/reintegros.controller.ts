import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReintegrosService } from './reintegros.service';
import { ListarSolicitudesQueryDto } from './dto/listar-solicitudes-query.dto';
import { clampPageLimit, sanitizeSearchTerm } from '../../common/sanitize';

function getOrgIdFromHeaders(headers: Record<string, any>): string | undefined {
  const h = Object.fromEntries(Object.entries(headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return (h['x-organizacion-id'] as string) || (h['x-org-id'] as string);
}
function requireOrgId(headers: Record<string, any>): string {
  const orgId = getOrgIdFromHeaders(headers);
  if (!orgId || !orgId.trim())
    throw new BadRequestException('X-Organizacion-ID requerido en el header');
  return orgId;
}

@Controller('reintegros')
export class ReintegrosController {
  constructor(private readonly service: ReintegrosService) {}

  @Post('solicitudes')
  async crearSolicitud(
    @Headers() headers: Record<string, any>,
    @Body()
    body: {
      personaTipo?: 'TITULAR' | 'FAMILIAR';
      afiliadoId?: string | number | bigint;
      familiarId?: string | number | bigint;
      tipo?: 'MEDICAMENTO' | 'PRACTICA';
      fechaFactura?: string;
      items?: {
        descripcion: string;
        cantidad: number;
        importe: number;
        porcentaje?: number;
        tipoItem?: 'MEDICAMENTO' | 'PRACTICA';
      }[];
    },
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.crearBorrador(organizacionId, body);
  }

  @Patch('solicitudes/:id/presentar')
  async presentarSolicitud(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body() body?: { observacion?: string; actorId?: string },
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.presentar(organizacionId, id, body?.observacion, body?.actorId);
  }

  @Patch('solicitudes/:id/observar')
  async observarSolicitud(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body() body?: { observacion?: string; actorId?: string },
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.observar(organizacionId, id, body?.observacion, body?.actorId);
  }

  @Patch('solicitudes/:id/aprobar')
  async aprobarSolicitud(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body() body?: { importeAprobado?: number; observacion?: string; actorId?: string },
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.aprobar(
      organizacionId,
      id,
      body?.importeAprobado,
      body?.observacion,
      body?.actorId,
    );
  }

  @Patch('solicitudes/:id/rechazar')
  async rechazarSolicitud(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body() body?: { observacion?: string; actorId?: string },
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.rechazar(organizacionId, id, body?.observacion, body?.actorId);
  }

  @Post('solicitudes/:id/adjuntos')
  async agregarAdjunto(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body()
    body?: {
      tipoAdjunto?: 'FACTURA' | 'RECETA' | 'ORDEN' | 'INFORME' | 'OTRO';
      url?: string;
      hash?: string;
      mime?: string;
      size?: number;
      subidoPorId?: string;
    },
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.agregarAdjunto(organizacionId, id, body ?? {});
  }

  @Get('solicitudes/:id/comprobante')
  async descargarComprobante(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const organizacionId = requireOrgId(headers);
    const file = await this.service.getComprobantePdf(organizacionId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    return res.send(file.buffer);
  }

  @Post('solicitudes/:id/orden-pago')
  async generarOrdenPago(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body()
    body?: { medioPago?: 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'OTRO'; monto?: number },
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.generarOrdenPago(organizacionId, id, body?.medioPago, body?.monto);
  }

  @Post('solicitudes/:id/pagar')
  async pagarSolicitud(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body()
    body?: { medioPago?: 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'OTRO'; monto?: number },
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.pagar(organizacionId, id, body?.medioPago, body?.monto);
  }

  @Get('solicitudes')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async listarSolicitudes(
    @Headers() headers: Record<string, any>,
    @Query() query: ListarSolicitudesQueryDto,
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.listar(organizacionId, {
      q: query.q ? sanitizeSearchTerm(query.q) : undefined,
      estado: query.estado,
      tipo: query.tipo,
      afiliadoId: query.afiliadoId,
      desde: query.desde,
      hasta: query.hasta,
      page: query.page ? Math.max(1, Number(query.page)) : undefined,
      pageSize: query.pageSize ? clampPageLimit(Number(query.pageSize)) : undefined,
    });
  }

  @Get('solicitudes/:id')
  async getDetalle(@Headers() headers: Record<string, any>, @Param('id') id: string) {
    const organizacionId = requireOrgId(headers);
    return this.service.getDetalle(organizacionId, id);
  }

  @Post('validar')
  async validar(
    @Headers() headers: Record<string, any>,
    @Body()
    body: {
      personaTipo?: 'TITULAR' | 'FAMILIAR';
      afiliadoId?: string | number | bigint;
      familiarId?: string | number | bigint;
      tipo?: 'MEDICAMENTO' | 'PRACTICA';
      fechaFactura?: string;
      importe?: number;
      items?: { descripcion: string; cantidad: number; importe: number; porcentaje?: number; tipoItem?: 'MEDICAMENTO' | 'PRACTICA' }[];
    },
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.validar(organizacionId, body);
  }

  @Get('politicas')
  async listarPoliticas(@Headers() headers: Record<string, any>, @Query('activo') activo?: string) {
    const organizacionId = requireOrgId(headers);
    return this.service.listarPoliticas(organizacionId, {
      activo: typeof activo === 'string' ? activo !== 'false' : undefined,
    });
  }

  @Post('politicas')
  async crearPolitica(
    @Headers() headers: Record<string, any>,
    @Body()
    body: {
      vigenteDesde?: string;
      vigenteHasta?: string | null;
      activo?: boolean;
      topeMensual?: number;
      topeAnual?: number;
      porcentajeMedicamento?: number;
      porcentajePractica?: number;
      diasVentanaPresentacion?: number;
      carenciaMeses?: number;
      maxOrdenesPorGrupo?: number;
      maxMedicamentosPorOrden?: number;
      topesPrestaciones?: any;
      requisitosAdjuntos?: any;
      exclusiones?: any;
    },
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.crearPolitica(organizacionId, body);
  }

  @Patch('politicas/:id')
  async actualizarPolitica(
    @Headers() headers: Record<string, any>,
    @Param('id') id: string,
    @Body()
    body: {
      vigenteDesde?: string;
      vigenteHasta?: string | null;
      activo?: boolean;
      topeMensual?: number;
      topeAnual?: number;
      porcentajeMedicamento?: number;
      porcentajePractica?: number;
      diasVentanaPresentacion?: number;
      carenciaMeses?: number;
      maxOrdenesPorGrupo?: number;
      maxMedicamentosPorOrden?: number;
      topesPrestaciones?: any;
      requisitosAdjuntos?: any;
      exclusiones?: any;
    },
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.actualizarPolitica(organizacionId, id, body);
  }
}
