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
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import type { CrearUsuarioDto, ActualizarUsuarioDto, CambiarPasswordDto, ResetPasswordDto } from './usuarios.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RolUsuario, EstadoUsuario } from '@prisma/client';
import type { Usuario } from '@prisma/client';

@Controller('usuarios')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Roles(RolUsuario.ADMIN)
  async crear(@Body() dto: CrearUsuarioDto, @CurrentUser() currentUser: Usuario) {
    return this.usuariosService.crear({
      ...dto,
      organizacionId: currentUser.organizacionId,
      creadoPor: currentUser.id.toString(),
    });
  }

  @Get()
  @Roles(RolUsuario.ADMIN)
  async listar(
    @CurrentUser() currentUser: Usuario,
    @Query('estado') estado?: EstadoUsuario,
    @Query('roles') roles?: string,
    @Query('busqueda') busqueda?: string,
  ) {
    const filtros: any = {};
    
    if (estado) filtros.estado = estado;
    if (roles) filtros.roles = roles.split(',') as RolUsuario[];
    if (busqueda) filtros.busqueda = busqueda;

    return this.usuariosService.listar(currentUser.organizacionId, filtros);
  }

  @Get(':id')
  @Roles(RolUsuario.ADMIN)
  async obtener(@Param('id') id: string) {
    return this.usuariosService.obtenerPorId(id);
  }

  @Put(':id')
  @Roles(RolUsuario.ADMIN)
  async actualizar(@Param('id') id: string, @Body() dto: ActualizarUsuarioDto) {
    return this.usuariosService.actualizar(id, dto);
  }

  @Put(':id/activar')
  @Roles(RolUsuario.ADMIN)
  async activar(@Param('id') id: string) {
    return this.usuariosService.activar(id);
  }

  @Put(':id/desactivar')
  @Roles(RolUsuario.ADMIN)
  async desactivar(@Param('id') id: string) {
    return this.usuariosService.desactivar(id);
  }

  @Put(':id/bloquear')
  @Roles(RolUsuario.ADMIN)
  async bloquear(@Param('id') id: string, @Body() body: { hasta?: string }) {
    const hasta = body.hasta ? new Date(body.hasta) : undefined;
    return this.usuariosService.bloquear(id, hasta);
  }

  @Delete(':id')
  @Roles(RolUsuario.ADMIN)
  async eliminar(@Param('id') id: string) {
    await this.usuariosService.eliminar(id);
    return { message: 'Usuario eliminado correctamente' };
  }

  @Post('cambiar-password')
  async cambiarPassword(@Body() dto: CambiarPasswordDto, @CurrentUser() currentUser: Usuario) {
    await this.usuariosService.cambiarPassword(currentUser.id.toString(), dto);
    return { message: 'Contraseña cambiada correctamente' };
  }

  @Post(':id/reset-password')
  @Roles(RolUsuario.ADMIN)
  async resetPassword(@Param('id') id: string, @Body() body: { passwordNueva: string }) {
    await this.usuariosService.resetPassword({
      usuarioId: id,
      passwordNueva: body.passwordNueva,
    });
    return { message: 'Contraseña restablecida correctamente' };
  }

  @Get(':id/sesiones')
  @Roles(RolUsuario.ADMIN)
  async obtenerSesiones(@Param('id') id: string) {
    return this.usuariosService.obtenerSesionesActivas(id);
  }

  @Get('mi-perfil/sesiones')
  async misSesiones(@CurrentUser() currentUser: Usuario) {
    return this.usuariosService.obtenerSesionesActivas(currentUser.id.toString());
  }
}
