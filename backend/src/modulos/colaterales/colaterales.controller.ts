// src/modulos/colaterales/colaterales.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { CreateColateralDto, UpdateColateralDto } from './colaterales.service';
import { ColateralesService } from './colaterales.service';
import { ColateralesCalculoService } from './colaterales-calculo.service';
import { AuditService } from '../../common/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';

type ReqWithIp = { ip?: string; headers?: Record<string, string> };

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

@Controller('colaterales')
export class ColateralesController {
  constructor(
    private readonly service: ColateralesService,
    private readonly calc: ColateralesCalculoService,
    private readonly audit: AuditService,
  ) {}

  // ===================== RUTAS ESTÁTICAS =====================

  @Get('parentescos')
  async getParentescos(@Headers() headers: Record<string, any>) {
    const organizacionId = requireOrgId(headers);
    return this.service.listParentescos(organizacionId);
  }

  // GET /colaterales/padrones?afiliadoId=123
  @Get('padrones')
  async getPadronesQuery(
    @Headers() headers: Record<string, any>,
    @Query('afiliadoId') afiliadoId?: string,
  ) {
    const organizacionId = requireOrgId(headers);
    if (!afiliadoId) return [];
    return this.calc.listPadronesActivos(organizacionId, BigInt(afiliadoId));
  }

  // GET /colaterales/precio?afiliadoId=...&fecha=YYYY-MM-DD
  @Get('precio')
  async getPrecioQuery(
    @Headers() headers: Record<string, any>,
    @Query('afiliadoId') afiliadoId?: string,
    @Query('fecha') fecha?: string,
  ) {
    const organizacionId = requireOrgId(headers);
    if (!afiliadoId) throw new BadRequestException('afiliadoId requerido');
    return this.service.getPrecio(organizacionId, afiliadoId, fecha);
  }

  // POST /colaterales  (compat: afiliadoId en body)
  @Post()
  async createColateralBody(
    @Headers() headers: Record<string, any>,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
    @Body() body: unknown,
  ) {
    const organizacionId = requireOrgId(headers);
    const b = body as Partial<CreateColateralDto> & { afiliadoId?: string | number | bigint };
    if (b?.afiliadoId == null) throw new BadRequestException('afiliadoId requerido');
    const result = await this.service.createColateral(organizacionId, b.afiliadoId, b as CreateColateralDto);
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'COLATERAL_CREAR',
      entidad: 'Colateral',
      entidadId: (result as unknown as { id?: bigint })?.id != null ? String((result as unknown as { id: bigint }).id) : undefined,
      payloadDespues: { afiliadoId: String(b.afiliadoId), nombre: (b as CreateColateralDto).nombre },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  // ===================== POR AFILIADO =====================

  // GET /colaterales/afiliados/:afiliadoId/colaterales
  @Get('afiliados/:afiliadoId/colaterales')
  async listColaterales(
    @Headers() headers: Record<string, any>,
    @Param('afiliadoId') afiliadoId: string,
    @Query('soloActivos') soloActivos?: string,
  ) {
    const organizacionId = requireOrgId(headers);
    const onlyActives = typeof soloActivos === 'string' ? soloActivos !== 'false' : true;
    return this.service.listColaterales(organizacionId, afiliadoId, onlyActives);
  }

  // POST /colaterales/afiliados/:afiliadoId/colaterales
  @Post('afiliados/:afiliadoId/colaterales')
  async createColateralScoped(
    @Headers() headers: Record<string, any>,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
    @Param('afiliadoId') afiliadoId: string,
    @Body() dto: CreateColateralDto,
  ) {
    const organizacionId = requireOrgId(headers);
    const result = await this.service.createColateral(organizacionId, afiliadoId, dto);
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'COLATERAL_CREAR',
      entidad: 'Colateral',
      entidadId: (result as unknown as { id?: bigint })?.id != null ? String((result as unknown as { id: bigint }).id) : undefined,
      payloadDespues: { afiliadoId, nombre: dto.nombre },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  // PATCH /colaterales/afiliados/:afiliadoId/colaterales/:colateralId
  @Patch('afiliados/:afiliadoId/colaterales/:colateralId')
  async updateColateral(
    @Headers() headers: Record<string, any>,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
    @Param('afiliadoId') afiliadoId: string,
    @Param('colateralId') colateralId: string,
    @Body() dto: UpdateColateralDto,
  ) {
    const organizacionId = requireOrgId(headers);
    const result = await this.service.updateColateral(organizacionId, afiliadoId, colateralId, dto);
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'COLATERAL_ACTUALIZAR',
      entidad: 'Colateral',
      entidadId: colateralId,
      payloadDespues: dto as unknown as Record<string, unknown>,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  // DELETE /colaterales/afiliados/:afiliadoId/colaterales/:colateralId
  @Delete('afiliados/:afiliadoId/colaterales/:colateralId')
  async removeColateral(
    @Headers() headers: Record<string, any>,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
    @Param('afiliadoId') afiliadoId: string,
    @Param('colateralId') colateralId: string,
    @Query('hard') hard?: string,
  ) {
    const organizacionId = requireOrgId(headers);
    const result = await this.service.removeColateral(organizacionId, afiliadoId, colateralId, {
      hard: hard === 'true',
    });
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'COLATERAL_ELIMINAR',
      entidad: 'Colateral',
      entidadId: colateralId,
      payloadDespues: { afiliadoId, hard: hard === 'true' },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }

  // ======= NUEVAS RUTAS DE CONFIG/IMPUTACIÓN J38 (lo que te da 404) =======

  // GET /colaterales/afiliados/:afiliadoId/config
  @Get('afiliados/:afiliadoId/config')
  async getConfigColat(
    @Headers() headers: Record<string, any>,
    @Param('afiliadoId') afiliadoId: string,
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.getImputacionColaterales(organizacionId, afiliadoId);
  }

  /* POST /colaterales/afiliados/:afiliadoId/imputacion  { padronId }
  @Post('afiliados/:afiliadoId/imputacion')
  async setImputacionColat(
    @Headers() headers: Record<string, any>,
    @Param('afiliadoId') afiliadoId: string,
    @Body() body: { padronId?: string | number | bigint | null },
  ) {
    const organizacionId = requireOrgId(headers);
    if (body?.padronId == null) throw new BadRequestException('padronId requerido');
    return this.service.setImputacionColaterales(organizacionId, afiliadoId, body.padronId);
  }
    */

  // Obtener imputación J38 del afiliado (padronColatId)
  @Get('afiliados/:afiliadoId/imputacion')
  async getImputacionColaterales(
    @Headers() headers: Record<string, any>,
    @Param('afiliadoId') afiliadoId: string,
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.getImputacionColaterales(organizacionId, afiliadoId);
  }

  // Cambiar imputación J38 del afiliado (registra novedades de cambio)
  @Post('afiliados/:afiliadoId/imputacion')
  async setImputacionColaterales(
    @Headers() headers: Record<string, any>,
    @Req() req: ReqWithIp,
    @CurrentUser() user: Usuario,
    @Param('afiliadoId') afiliadoId: string,
    @Body() body: { padronId?: string | number | bigint },
  ) {
    const organizacionId = requireOrgId(headers);
    if (!body?.padronId) throw new BadRequestException('padronId requerido');
    const result = await this.service.setImputacionColaterales(organizacionId, afiliadoId, body.padronId);
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'COLATERAL_IMPUTACION',
      entidad: 'CoseguroAfiliado',
      entidadId: afiliadoId,
      payloadDespues: { padronId: String(body.padronId) },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });
    return result;
  }
  // ===================== COMPAT PATH (dejar al final) =====================

  // GET /colaterales/:afiliadoId/precio
  @Get(':afiliadoId/precio')
  async getPrecioPath(
    @Headers() headers: Record<string, any>,
    @Param('afiliadoId') afiliadoId: string,
    @Query('fecha') fecha?: string,
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.getPrecio(organizacionId, afiliadoId, fecha);
  }
}
