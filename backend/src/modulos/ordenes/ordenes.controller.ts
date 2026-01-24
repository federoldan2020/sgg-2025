// src/modulos/ordenes/ordenes.controller.ts
import { Body, Controller, Get, Param, Post, UsePipes, ValidationPipe } from '@nestjs/common';
import type { OrdenCredito } from '@prisma/client';
import { OrdenesService } from './ordenes.service';
import { CrearOrdenCreditoDto, PreviewOrdenCreditoDto } from './dto';
import { OrgId } from 'src/common/decorators/org-id.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('ordenes')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Public() // Temporalmente público para testing
export class OrdenesController {
  constructor(private readonly svc: OrdenesService) {}

  @Post('preview')
  async preview(@OrgId() organizacionId: string, @Body() dto: PreviewOrdenCreditoDto) {
    // ✅ PASAR org separado del DTO
    return await this.svc.preview(organizacionId, dto);
  }

  @Post()
  async crear(
    @OrgId() organizacionId: string,
    @Body() dto: CrearOrdenCreditoDto,
  ): Promise<OrdenCredito> {
    return await this.svc.crearOrden(organizacionId, dto);
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
