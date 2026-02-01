// src/modulos/ordenes/ordenes.controller.ts
import { Body, Controller, Get, Param, Post, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import type { OrdenCredito } from '@prisma/client';
import { OrdenesService } from './ordenes.service';
import { CrearOrdenCreditoDto, PreviewOrdenCreditoDto } from './dto';
import { OrgId } from 'src/common/decorators/org-id.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { AuditService } from '../../common/audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';

type ReqWithIp = { ip?: string; headers?: Record<string, string> };

@Controller('ordenes')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Public()
export class OrdenesController {
  constructor(
    private readonly svc: OrdenesService,
    private readonly audit: AuditService,
  ) {}

  @Post('preview')
  async preview(@OrgId() organizacionId: string, @Body() dto: PreviewOrdenCreditoDto) {
    // ✅ PASAR org separado del DTO
    return await this.svc.preview(organizacionId, dto);
  }

  @Post()
  async crear(
    @OrgId() organizacionId: string,
    @Body() dto: CrearOrdenCreditoDto,
    @Req() req: ReqWithIp,
    @CurrentUser() user?: Usuario,
  ): Promise<OrdenCredito> {
    const result = await this.svc.crearOrden(organizacionId, dto);
    if (user) {
      await this.audit.log({
        usuarioId: user.id.toString(),
        organizacionId,
        accion: 'ORDEN_CREDITO_CREAR',
        entidad: 'OrdenCredito',
        entidadId: (result as unknown as { id?: bigint })?.id != null ? String((result as unknown as { id: bigint }).id) : undefined,
        payloadDespues: { afiliadoId: dto.afiliadoId },
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
    }
    return result;
  }

  @Get(':afiliadoId')
  async listar(@OrgId() organizacionId: string, @Param('afiliadoId') afiliadoId: string) {
    return await this.svc.listarPorAfiliado(organizacionId, Number(afiliadoId));
  }

  @Get('detalle/:ordenId')
  async detalleOrden(
    @OrgId() organizacionId: string,
    @Param('ordenId') ordenId: string,
  ) {
    return await this.svc.detalleOrdenConPagos(organizacionId, BigInt(ordenId));
  }

  @Get('detalles-pagos/:ordenId')
  async detallesPagos(@OrgId() organizacionId: string, @Param('ordenId') ordenId: string) {
    return await this.svc.detallesPagosOrden(organizacionId, Number(ordenId));
  }
}
