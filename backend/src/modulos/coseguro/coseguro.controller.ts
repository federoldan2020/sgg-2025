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
  Req,
} from '@nestjs/common';
import { CoseguroService } from './coseguro.service';
import { AuditService } from '../../common/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';

// Acepta X-Organizacion-ID o x-org-id (Nest normaliza en minúsculas)
function getOrgIdFromHeaders(headers: Record<string, any>): string | undefined {
  const h = Object.fromEntries(Object.entries(headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return (h['x-organizacion-id'] as string) || (h['x-org-id'] as string);
}
function requireOrgId(headers: Record<string, any>): string {
  const orgId = getOrgIdFromHeaders(headers);
  if (!orgId || !orgId.trim()) throw new BadRequestException('X-Organizacion-ID requerido');
  return orgId;
}

type ReqWithIp = { ip?: string; headers?: Record<string, string> };

@Controller('coseguro')
export class CoseguroController {
  constructor(
    private readonly service: CoseguroService,
    private readonly audit: AuditService,
  ) {}

  // ============================================================
  // Lecturas (sólo Coseguro: J22, estado, padrones)
  // ============================================================

  /** Precio base J22 por query (?afiliadoId=…&fecha=YYYY-MM-DD) */
  @Get('precio')
  async getPrecioBaseQuery(
    @Headers() headers: Record<string, any>,
    @Query('afiliadoId') afiliadoId?: string,
    @Query('fecha') fecha?: string,
  ) {
    const organizacionId = requireOrgId(headers);
    if (!afiliadoId) throw new BadRequestException('afiliadoId requerido');
    return this.service.getPrecioBase(organizacionId, afiliadoId, fecha);
  }

  /** Panel de coseguro (sin colaterales) */
  @Get('afiliados/:afiliadoId')
  async getCoseguroPanel(
    @Headers() headers: Record<string, any>,
    @Param('afiliadoId') afiliadoId: string,
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.getCoseguroPanel(organizacionId, afiliadoId);
  }

  // ============================================================
  // Upsert de configuración (J22)
  // ============================================================

  /**
   * Upsert de configuración de Coseguro (J22).
   * Body:
   * {
   *   afiliadoId: string|number|bigint,
   *   estado: 'activo'|'baja',
   *   padronCoseguroId?: string|number|bigint|null,
   *   ocurridoEn?: string (ISO),
   *   reasignar?: boolean   // para confirmar reasignación de padrón activo
   * }
   *
   * Errores:
   * - 409 { code: 'REQUIERE_REASIGNACION_J22', currentPadronId, newPadronId }
   */
  @Post('upsert')
  async upsertConfig(
    @Headers() headers: Record<string, any>,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
    @Body()
    body: {
      afiliadoId?: string | number | bigint;
      estado?: 'activo' | 'baja';
      padronCoseguroId?: string | number | bigint | null;
      ocurridoEn?: string;
      reasignar?: boolean;
    },
  ) {
    const organizacionId = requireOrgId(headers);
    if (body?.afiliadoId == null) throw new BadRequestException('afiliadoId requerido');
    if (!body?.estado || !['activo', 'baja'].includes(body.estado))
      throw new BadRequestException('estado inválido (activo|baja)');

    const result = await this.service.upsertConfig({
      organizacionId,
      afiliadoId: body.afiliadoId,
      estado: body.estado,
      padronCoseguroId: body.padronCoseguroId ?? null,
      ocurridoEn: body?.ocurridoEn,
      reasignar: !!body?.reasignar,
    });
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'COSEGURO_UPSERT',
      entidad: 'CoseguroAfiliado',
      entidadId: String(body.afiliadoId),
      payloadDespues: { estado: body.estado, padronCoseguroId: body.padronCoseguroId },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  // ============================================================
  // Acciones de negocio (sólo Coseguro / J22) - compat
  // ============================================================

  /** Alta de coseguro (dispara novedad J22 con precio vigente) */
  @Post('afiliados/:afiliadoId/alta')
  async altaCoseguro(
    @Headers() headers: Record<string, any>,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
    @Param('afiliadoId') afiliadoId: string,
    @Body() body: { padronId: string | number | bigint; ocurridoEn?: string },
  ) {
    const organizacionId = requireOrgId(headers);
    if (!body?.padronId) throw new BadRequestException('padronId requerido');

    const ocurridoEn = body?.ocurridoEn ? new Date(body.ocurridoEn) : undefined;
    const result = await this.service.altaCoseguro(organizacionId, afiliadoId, body.padronId, ocurridoEn);
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'COSEGURO_ALTA',
      entidad: 'CoseguroAfiliado',
      entidadId: afiliadoId,
      payloadDespues: { padronId: String(body.padronId) },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  /** Baja de coseguro (dispara novedad J22=0) */
  @Post('afiliados/:afiliadoId/baja')
  async bajaCoseguro(
    @Headers() headers: Record<string, any>,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
    @Param('afiliadoId') afiliadoId: string,
    @Body() body?: { ocurridoEn?: string },
  ) {
    const organizacionId = requireOrgId(headers);
    const ocurridoEn = body?.ocurridoEn ? new Date(body.ocurridoEn) : undefined;
    const result = await this.service.bajaCoseguro(organizacionId, afiliadoId, ocurridoEn);
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'COSEGURO_BAJA',
      entidad: 'CoseguroAfiliado',
      entidadId: afiliadoId,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  /** Modificación de precio de coseguro (J22 = nuevoPrecio) */
  @Patch('afiliados/:afiliadoId/modificar')
  async modificarPrecioCoseguro(
    @Headers() headers: Record<string, any>,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
    @Param('afiliadoId') afiliadoId: string,
    @Body()
    body: { padronId: string | number | bigint; nuevoPrecio: string | number; ocurridoEn?: string },
  ) {
    const organizacionId = requireOrgId(headers);
    if (body?.padronId == null) throw new BadRequestException('padronId requerido');
    if (body?.nuevoPrecio == null) throw new BadRequestException('nuevoPrecio requerido');

    const ocurridoEn = body?.ocurridoEn ? new Date(body.ocurridoEn) : undefined;
    const result = await this.service.modificarPrecioCoseguro(
      organizacionId,
      afiliadoId,
      body.padronId,
      body.nuevoPrecio,
      ocurridoEn,
    );
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'COSEGURO_MODIFICAR_PRECIO',
      entidad: 'CoseguroAfiliado',
      entidadId: afiliadoId,
      payloadDespues: { padronId: String(body.padronId), nuevoPrecio: body.nuevoPrecio },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  /** Suspender afiliado en coseguro (por deuda/incumplimiento) */
  @Post('afiliados/:afiliadoId/suspender')
  async suspenderCoseguro(
    @Headers() headers: Record<string, any>,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
    @Param('afiliadoId') afiliadoId: string,
    @Body() body?: { motivo?: string; suspendidoPorId?: string; ocurridoEn?: string },
  ) {
    const organizacionId = requireOrgId(headers);
    const ocurridoEn = body?.ocurridoEn ? new Date(body.ocurridoEn) : undefined;
    const result = await this.service.suspenderCoseguro(
      organizacionId,
      afiliadoId,
      body?.motivo,
      body?.suspendidoPorId,
      ocurridoEn,
    );
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'COSEGURO_SUSPENDER',
      entidad: 'CoseguroAfiliado',
      entidadId: afiliadoId,
      payloadDespues: { motivo: body?.motivo },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  /** Rehabilitar afiliado en coseguro */
  @Post('afiliados/:afiliadoId/rehabilitar')
  async rehabilitarCoseguro(
    @Headers() headers: Record<string, any>,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
    @Param('afiliadoId') afiliadoId: string,
    @Body() body?: { ocurridoEn?: string },
  ) {
    const organizacionId = requireOrgId(headers);
    const ocurridoEn = body?.ocurridoEn ? new Date(body.ocurridoEn) : undefined;
    const result = await this.service.rehabilitarCoseguro(organizacionId, afiliadoId, ocurridoEn);
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'COSEGURO_REHABILITAR',
      entidad: 'CoseguroAfiliado',
      entidadId: afiliadoId,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  // ============================================================
  // Compat temporal (/coseguro/:afiliadoId/precio)
  // ============================================================
  @Get(':afiliadoId/precio')
  async getPrecioBasePath(
    @Headers() headers: Record<string, any>,
    @Param('afiliadoId') afiliadoId: string,
    @Query('fecha') fecha?: string,
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.getPrecioBase(organizacionId, afiliadoId, fecha);
  }
}
