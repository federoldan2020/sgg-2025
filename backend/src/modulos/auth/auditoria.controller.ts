import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { RolUsuario } from '@prisma/client';
import { CurrentUser } from './decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { clampPageLimit } from '../../common/sanitize';

@Controller('auditoria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditoriaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
  async listar(
    @CurrentUser() user: Usuario,
    @Query('organizacionId') organizacionId?: string,
    @Query('accion') accion?: string,
    @Query('entidad') entidad?: string,
    @Query('usuarioId') usuarioId?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ) {
    const limit = clampPageLimit(limitStr ? parseInt(limitStr, 10) : 50);
    const offset = Math.max(0, parseInt(offsetStr || '0', 10) || 0);

    const where: Record<string, unknown> = {};

    // ADMIN solo ve eventos de su organización
    if (user.roles.includes(RolUsuario.SUPERADMIN)) {
      if (organizacionId) where.organizacionId = organizacionId;
      if (usuarioId) where.usuarioId = usuarioId;
    } else {
      where.organizacionId = user.organizacionId;
    }

    if (accion) where.accion = accion;
    if (entidad) where.entidad = entidad;

    const [eventos, total] = await Promise.all([
      this.prisma.eventoAuditoria.findMany({
        where,
        orderBy: { creadoEn: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          organizacionId: true,
          usuarioId: true,
          accion: true,
          entidad: true,
          entidadId: true,
          payloadAntes: true,
          payloadDespues: true,
          ipAddress: true,
          creadoEn: true,
        },
      }),
      this.prisma.eventoAuditoria.count({ where }),
    ]);

    return { eventos, total, limit, offset };
  }
}
