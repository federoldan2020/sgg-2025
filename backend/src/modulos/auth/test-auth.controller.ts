import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RolUsuario } from '@prisma/client';
import type { Usuario } from '@prisma/client';

@Controller('test-auth')
export class TestAuthController {
  @Public()
  @Get('public')
  async endpointPublico() {
    return {
      message: 'Este endpoint es público - no requiere autenticación',
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('protected')
  async endpointProtegido(@CurrentUser() user: Usuario) {
    return {
      message: 'Este endpoint requiere autenticación',
      user: {
        id: user.id.toString(),
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        roles: user.roles,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Get('admin-only')
  async endpointSoloAdmin(@CurrentUser() user: Usuario) {
    return {
      message: 'Este endpoint es solo para administradores',
      user: {
        id: user.id.toString(),
        email: user.email,
        roles: user.roles,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.CONTABILIDAD, RolUsuario.ADMIN)
  @Get('contabilidad')
  async endpointContabilidad(@CurrentUser() user: Usuario) {
    return {
      message: 'Este endpoint es para usuarios de contabilidad o admin',
      user: {
        id: user.id.toString(),
        email: user.email,
        roles: user.roles,
      },
      timestamp: new Date().toISOString(),
    };
  }
}
