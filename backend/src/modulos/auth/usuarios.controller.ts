import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import type { CrearUsuarioDto, ActualizarUsuarioDto, CambiarPasswordDto, ResetPasswordDto } from './usuarios.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RolUsuario, EstadoUsuario } from '@prisma/client';
import type { Usuario } from '@prisma/client';
import type { Request } from 'express';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
  async crear(@Body() dto: CrearUsuarioDto, @CurrentUser() currentUser: Usuario, @Req() req: Request) {
    const orgId = this.usuariosService.resolverOrganizacionId(dto.organizacionId, currentUser);
    return this.usuariosService.crear({
      ...dto,
      organizacionId: orgId,
      creadoPor: currentUser.id.toString(),
    }, {
      usuarioId: currentUser.id.toString(),
      organizacionId: orgId,
      ipAddress: (req as Request & { ip?: string })?.ip,
      userAgent: (req.headers as Record<string, string>)?.['user-agent'],
    });
  }

  @Get()
  @Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
  async listar(
    @CurrentUser() currentUser: Usuario,
    @Query('organizacionId') organizacionIdQuery?: string,
    @Query('estado') estado?: EstadoUsuario,
    @Query('roles') roles?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    const orgId = this.usuariosService.resolverOrganizacionId(organizacionIdQuery, currentUser);
    const filtros: Record<string, unknown> = {};
    if (estado) filtros.estado = estado;
    if (roles) filtros.roles = roles.split(',') as RolUsuario[];
    if (busqueda) filtros.busqueda = busqueda;
    return this.usuariosService.listar(orgId, filtros);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
  async obtener(@Param('id') id: string, @CurrentUser() currentUser: Usuario) {
    return this.usuariosService.obtenerPorId(id, currentUser);
  }

  @Put(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
  async actualizar(@Param('id') id: string, @Body() dto: ActualizarUsuarioDto, @CurrentUser() currentUser: Usuario) {
    return this.usuariosService.actualizar(id, dto, currentUser);
  }

  @Put(':id/activar')
  @Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
  async activar(@Param('id') id: string, @CurrentUser() currentUser: Usuario) {
    return this.usuariosService.activar(id, currentUser);
  }

  @Put(':id/desactivar')
  @Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
  async desactivar(@Param('id') id: string, @CurrentUser() currentUser: Usuario) {
    return this.usuariosService.desactivar(id, currentUser);
  }

  @Put(':id/bloquear')
  @Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
  async bloquear(@Param('id') id: string, @Body() body: { hasta?: string }, @CurrentUser() currentUser: Usuario) {
    const hasta = body.hasta ? new Date(body.hasta) : undefined;
    return this.usuariosService.bloquear(id, hasta, currentUser);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
  async eliminar(@Param('id') id: string, @CurrentUser() currentUser: Usuario) {
    await this.usuariosService.eliminar(id, currentUser);
    return { message: 'Usuario eliminado correctamente' };
  }

  @Post('cambiar-password')
  async cambiarPassword(@Body() dto: CambiarPasswordDto, @CurrentUser() currentUser: Usuario) {
    await this.usuariosService.cambiarPassword(currentUser.id.toString(), dto);
    return { message: 'Contraseña cambiada correctamente' };
  }

  @Post(':id/reset-password')
  @Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
  async resetPassword(@Param('id') id: string, @Body() body: { passwordNueva: string }, @CurrentUser() currentUser: Usuario) {
    await this.usuariosService.resetPassword({
      usuarioId: id,
      passwordNueva: body.passwordNueva,
    }, currentUser);
    return { message: 'Contraseña restablecida correctamente' };
  }

  @Get('mi-perfil/sesiones')
  async misSesiones(@CurrentUser() currentUser: Usuario) {
    return this.usuariosService.obtenerSesionesActivas(currentUser.id.toString());
  }

  @Get(':id/sesiones')
  @Roles(RolUsuario.ADMIN, RolUsuario.SUPERADMIN)
  async obtenerSesiones(@Param('id') id: string, @CurrentUser() currentUser: Usuario) {
    return this.usuariosService.obtenerSesionesActivas(id, currentUser);
  }
}
