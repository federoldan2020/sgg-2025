// src/modulos/movimientos/movimientos.controller.ts
import { Controller, Get, Param, Query, Post, Body, BadRequestException, Delete } from '@nestjs/common';
import { MovimientosService } from './movimientos.service';
import { OrgId } from 'src/common/decorators/org-id.decorator';
import { Public } from '../auth/decorators/public.decorator';

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
    @Query('periodoContable') periodoContableStr?: string, // Formato "YYYY-MM"
  ) {
    if (!afiliadoIdStr) throw new BadRequestException('Falta afiliadoId');

    const afiliadoId = BigInt(afiliadoIdStr);
    const padronId = padronIdStr ? BigInt(padronIdStr) : undefined;
    
    // Parsear fechas correctamente (soporta formato YYYY-MM-DD)
    let desde: Date | undefined;
    let hasta: Date | undefined;
    
    if (desdeStr) {
      // Si viene como YYYY-MM-DD, crear fecha en UTC para evitar problemas de zona horaria
      if (desdeStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        desde = new Date(desdeStr + 'T00:00:00.000Z');
      } else {
        desde = new Date(desdeStr);
      }
    }
    
    if (hastaStr) {
      if (hastaStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        hasta = new Date(hastaStr + 'T23:59:59.999Z');
      } else {
        hasta = new Date(hastaStr);
      }
    }
    
    const take = takeStr ? Math.min(Math.max(Number(takeStr) || 200, 1), 1000) : 200;
    
    // Validar formato de periodoContable si se proporciona
    const periodoContable = periodoContableStr && /^\d{4}-\d{2}$/.test(periodoContableStr)
      ? periodoContableStr
      : undefined;

    return this.svc.listarCtaCte(organizacionId, afiliadoId, desde, hasta, take, padronId, periodoContable);
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

  /**
   * ⚠️ ENDPOINT PELIGROSO: Borra TODOS los movimientos y resetea saldos
   * Solo disponible en desarrollo. Usar con extrema precaución.
   */
  @Delete('limpiar-todos')
  @Public() // Temporalmente público - en producción debería tener autenticación fuerte
  async limpiarTodos(@OrgId() organizacionId?: string) {
    return this.svc.limpiarTodos(organizacionId);
  }
}
