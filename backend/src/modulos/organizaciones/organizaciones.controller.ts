import { Controller, Get, Post, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { OrganizacionesService } from './organizaciones.service';
import type { CrearOrganizacionDto, ActualizarOrganizacionDto } from './organizaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RolUsuario } from '@prisma/client';
import type { Usuario } from '@prisma/client';
import type { Request } from 'express';

@Controller('organizaciones')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.SUPERADMIN)
export class OrganizacionesController {
  constructor(private readonly organizacionesService: OrganizacionesService) {}

  @Get()
  async listar() {
    return this.organizacionesService.listar();
  }

  @Get(':id')
  async obtener(@Param('id') id: string) {
    return this.organizacionesService.obtenerPorId(id);
  }

  @Post()
  async crear(
    @Body() dto: CrearOrganizacionDto,
    @CurrentUser() user: Usuario,
    @Req() req: Request,
  ) {
    return this.organizacionesService.crear(dto, {
      usuarioId: user.id.toString(),
      ipAddress: (req as Request & { ip?: string })?.ip,
      userAgent: (req.headers as Record<string, string>)?.['user-agent'],
    });
  }

  @Put(':id')
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarOrganizacionDto,
    @CurrentUser() user: Usuario,
    @Req() req: Request,
  ) {
    return this.organizacionesService.actualizar(id, dto, {
      usuarioId: user.id.toString(),
      ipAddress: (req as Request & { ip?: string })?.ip,
      userAgent: (req.headers as Record<string, string>)?.['user-agent'],
    });
  }

  @Get(':id/usuarios')
  async listarUsuarios(@Param('id') id: string) {
    return this.organizacionesService.listarUsuarios(id);
  }
}
