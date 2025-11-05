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
} from '@nestjs/common';
import type { CreateColateralDto, UpdateColateralDto } from './colaterales.service';
import { ColateralesService } from './colaterales.service';
import { ColateralesCalculoService } from './colaterales-calculo.service';

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
  async createColateralBody(@Headers() headers: Record<string, any>, @Body() body: unknown) {
    const organizacionId = requireOrgId(headers);
    const b = body as Partial<CreateColateralDto> & { afiliadoId?: string | number | bigint };
    if (b?.afiliadoId == null) throw new BadRequestException('afiliadoId requerido');
    return this.service.createColateral(organizacionId, b.afiliadoId, b as CreateColateralDto);
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
    @Param('afiliadoId') afiliadoId: string,
    @Body() dto: CreateColateralDto,
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.createColateral(organizacionId, afiliadoId, dto);
  }

  // PATCH /colaterales/afiliados/:afiliadoId/colaterales/:colateralId
  @Patch('afiliados/:afiliadoId/colaterales/:colateralId')
  async updateColateral(
    @Headers() headers: Record<string, any>,
    @Param('afiliadoId') afiliadoId: string,
    @Param('colateralId') colateralId: string,
    @Body() dto: UpdateColateralDto,
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.updateColateral(organizacionId, afiliadoId, colateralId, dto);
  }

  // DELETE /colaterales/afiliados/:afiliadoId/colaterales/:colateralId
  @Delete('afiliados/:afiliadoId/colaterales/:colateralId')
  async removeColateral(
    @Headers() headers: Record<string, any>,
    @Param('afiliadoId') afiliadoId: string,
    @Param('colateralId') colateralId: string,
    @Query('hard') hard?: string,
  ) {
    const organizacionId = requireOrgId(headers);
    return this.service.removeColateral(organizacionId, afiliadoId, colateralId, {
      hard: hard === 'true',
    });
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
    @Param('afiliadoId') afiliadoId: string,
    @Body() body: { padronId?: string | number | bigint },
  ) {
    const organizacionId = requireOrgId(headers);
    if (!body?.padronId) throw new BadRequestException('padronId requerido');
    return this.service.setImputacionColaterales(organizacionId, afiliadoId, body.padronId);
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
