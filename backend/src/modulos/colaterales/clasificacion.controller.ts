import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Query,
} from '@nestjs/common';
import { ClasificacionService } from './clasificacion.service';

function getOrgIdFromHeaders(headers: Record<string, any>): string | undefined {
  const h = Object.fromEntries(
    Object.entries(headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return (h['x-organizacion-id'] as string) || (h['x-org-id'] as string);
}
function requireOrgId(headers: Record<string, any>): string {
  const orgId = getOrgIdFromHeaders(headers);
  if (!orgId || !orgId.trim()) {
    throw new BadRequestException('X-Organizacion-ID requerido en el header');
  }
  return orgId;
}

@Controller('colaterales')
export class ClasificacionController {
  constructor(private readonly svc: ClasificacionService) {}

  /** Sugerencia para un integrante puntual. */
  @Get(':colateralId/sugerencia')
  async sugerirUno(
    @Headers() headers: Record<string, any>,
    @Param('colateralId') colateralId: string,
    @Query('fecha') fecha?: string,
  ) {
    const organizacionId = requireOrgId(headers);
    const at = fecha ? new Date(fecha) : undefined;
    return this.svc.sugerirParaColateral(organizacionId, colateralId, at);
  }

  /** Sugerencias para todos los integrantes activos de un afiliado. */
  @Get('afiliados/:afiliadoId/sugerencias')
  async sugerirAfiliado(
    @Headers() headers: Record<string, any>,
    @Param('afiliadoId') afiliadoId: string,
    @Query('fecha') fecha?: string,
  ) {
    const organizacionId = requireOrgId(headers);
    const at = fecha ? new Date(fecha) : undefined;
    return this.svc.sugerirParaAfiliado(organizacionId, afiliadoId, at);
  }
}
