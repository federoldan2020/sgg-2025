// src/modulos/movimientos/movimientos.controller.ts
import { Controller, Get, Param, Query, Post, Body, BadRequestException } from '@nestjs/common';
import { MovimientosService } from './movimientos.service';
import { OrgId } from 'src/common/decorators/org-id.decorator';

@Controller('movimientos')
export class MovimientosController {
  constructor(private readonly svc: MovimientosService) {}

  @Get('cta/:afiliadoId')
  async cta(
    @OrgId() organizacionId: string,
    @Param('afiliadoId') afiliadoIdParam: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('take') take?: string,
  ) {
    const afiliadoId = BigInt(afiliadoIdParam);
    return this.svc.listarCtaCte(
      organizacionId,
      afiliadoId,
      desde ? new Date(desde) : undefined,
      hasta ? new Date(hasta) : undefined,
      take ? Math.max(1, Number(take) || 200) : 200,
    );
  }

  @Get()
  async listar(
    @OrgId() organizacionId: string,
    @Query('afiliadoId') afiliadoIdStr: string,
    @Query('padronId') padronIdStr?: string,
    @Query('desde') desdeStr?: string,
    @Query('hasta') hastaStr?: string,
    @Query('take') takeStr?: string,
  ) {
    if (!afiliadoIdStr) throw new BadRequestException('Falta afiliadoId');

    const afiliadoId = BigInt(afiliadoIdStr);
    const padronId = padronIdStr ? BigInt(padronIdStr) : undefined;
    const desde = desdeStr ? new Date(desdeStr) : undefined;
    const hasta = hastaStr ? new Date(hastaStr) : undefined;
    const take = takeStr ? Math.min(Math.max(Number(takeStr) || 200, 1), 1000) : 200;

    return this.svc.listarCtaCte(organizacionId, afiliadoId, desde, hasta, take, padronId);
  }

  // Ajuste manual (opcional)
  @Post('ajuste/:afiliadoId')
  async ajuste(
    @OrgId() organizacionId: string,
    @Param('afiliadoId') afiliadoIdParam: string,
    @Body()
    body: {
      naturaleza: 'debito' | 'credito';
      concepto: string;
      importe: number;
      padronId?: string;
    },
  ) {
    const afiliadoId = BigInt(afiliadoIdParam);
    const padronId = body.padronId ? BigInt(body.padronId) : undefined;
    return this.svc.postMovimiento({
      organizacionId,
      afiliadoId,
      padronId,
      naturaleza: body.naturaleza,
      origen: 'ajuste',
      concepto: body.concepto,
      importe: body.importe,
      // asiento contable de ajuste si querés exigirlo:
      // asiento: { descripcion: `Ajuste CC Afiliado`, referenciaId: `AF:${afiliadoId}` },
    });
  }
}
