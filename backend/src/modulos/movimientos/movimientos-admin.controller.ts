// src/modulos/movimientos/movimientos-admin.controller.ts
//
// Endpoints administrativos del ledger (Fase 3 del modelo unificado de saldos).
// Todos requieren rol ADMIN o SUPERADMIN. Cubren:
//   - Recálculo de saldos desde el ledger (red de seguridad post-incidente).
//   - Bandeja de movimientos por revisar.
//   - Acciones sobre cada movimiento: aceptar como saldo a favor, vincular
//     a una obligación, o anular.

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import type { Usuario } from '@prisma/client';
import { OrgId } from '../../common/decorators/org-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../../common/audit.service';
import { MovimientosService } from './movimientos.service';

@Controller('admin/movimientos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
export class MovimientosAdminController {
  constructor(
    private readonly svc: MovimientosService,
    private readonly audit: AuditService,
  ) {}

  /**
   * POST /admin/movimientos/recalcular-saldos
   * Body: { afiliadoId?: string; dryRun?: boolean }
   *
   * - Si viene afiliadoId: recalcula solo ese afiliado.
   * - Si no: recalcula toda la organización (puede tardar).
   * - dryRun=true (default): reporta divergencias sin escribir.
   */
  @Post('recalcular-saldos')
  async recalcular(
    @OrgId() organizacionId: string,
    @CurrentUser() user: Usuario,
    @Body() body: { afiliadoId?: string; dryRun?: boolean },
  ) {
    const dryRun = body.dryRun !== false; // default true: seguro por defecto
    const result = body.afiliadoId
      ? await this.svc.recalcularSaldosAfiliado(
          organizacionId,
          BigInt(body.afiliadoId),
          dryRun,
        )
      : await this.svc.recalcularSaldosOrganizacion(organizacionId, dryRun);

    if (!dryRun) {
      await this.audit.log({
        usuarioId: user.id.toString(),
        organizacionId,
        accion: 'MOVIMIENTOS_RECALCULAR_SALDOS',
        entidad: 'Padron',
        entidadId: body.afiliadoId ?? 'organizacion',
        payloadDespues: result as unknown as Record<string, unknown>,
      });
    }

    return result;
  }

  /**
   * GET /admin/movimientos/por-revisar?afiliadoId=&padronId=&page=&pageSize=
   * Bandeja de créditos huérfanos generados por cobranza sin obligación
   * matcheada, o por excedente de cobranza.
   */
  @Get('por-revisar')
  async porRevisar(
    @OrgId() organizacionId: string,
    @Query('afiliadoId') afiliadoIdStr?: string,
    @Query('padronId') padronIdStr?: string,
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ) {
    return this.svc.listarPorRevisar(organizacionId, {
      afiliadoId: afiliadoIdStr ? BigInt(afiliadoIdStr) : undefined,
      padronId: padronIdStr ? BigInt(padronIdStr) : undefined,
      page: pageStr ? Number(pageStr) : undefined,
      pageSize: pageSizeStr ? Number(pageSizeStr) : undefined,
    });
  }

  /** POST /admin/movimientos/:id/aceptar-saldo-favor */
  @Post(':id/aceptar-saldo-favor')
  async aceptar(
    @OrgId() organizacionId: string,
    @CurrentUser() user: Usuario,
    @Param('id') idStr: string,
  ) {
    const result = await this.svc.aceptarComoSaldoFavor(
      organizacionId,
      BigInt(idStr),
    );
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'MOVIMIENTO_ACEPTAR_SALDO_FAVOR',
      entidad: 'MovimientoAfiliado',
      entidadId: idStr,
    });
    return result;
  }

  /**
   * POST /admin/movimientos/:id/vincular-obligacion
   * Body: { obligacionId: string }
   */
  @Post(':id/vincular-obligacion')
  async vincular(
    @OrgId() organizacionId: string,
    @CurrentUser() user: Usuario,
    @Param('id') idStr: string,
    @Body() body: { obligacionId: string },
  ) {
    if (!body.obligacionId) {
      throw new BadRequestException('obligacionId requerido');
    }
    const result = await this.svc.vincularAObligacion(
      organizacionId,
      BigInt(idStr),
      BigInt(body.obligacionId),
    );
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'MOVIMIENTO_VINCULAR_OBLIGACION',
      entidad: 'MovimientoAfiliado',
      entidadId: idStr,
      payloadDespues: {
        obligacionId: body.obligacionId,
        ...result,
      },
    });
    return result;
  }

  /**
   * POST /admin/movimientos/:id/anular
   * Body: { motivo: string }
   */
  @Post(':id/anular')
  async anular(
    @OrgId() organizacionId: string,
    @CurrentUser() user: Usuario,
    @Param('id') idStr: string,
    @Body() body: { motivo: string },
  ) {
    const motivo = (body.motivo ?? '').trim();
    if (!motivo) {
      throw new BadRequestException('motivo requerido');
    }
    const result = await this.svc.anularMovimientoPorRevision(
      organizacionId,
      BigInt(idStr),
      motivo,
    );
    await this.audit.log({
      usuarioId: user.id.toString(),
      organizacionId,
      accion: 'MOVIMIENTO_ANULAR',
      entidad: 'MovimientoAfiliado',
      entidadId: idStr,
      payloadDespues: { motivo, ...result },
    });
    return result;
  }
}
