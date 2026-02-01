import { Controller, Post, Body, Req, UseGuards, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import type { LoginDto, RefreshTokenDto } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('organizaciones')
  async listarOrganizaciones() {
    const orgs = await this.prisma.organizacion.findMany({
      where: { activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    return orgs;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos por minuto en login
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request & { organizacionId?: string }) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Tomar organizacionId del header (middleware) o del body
    const loginDto = {
      ...dto,
      organizacionId: req.organizacionId || dto.organizacionId,
    };
    
    return this.authService.login(loginDto, ipAddress, userAgent);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
    return { message: 'Logout exitoso' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  async logoutAll(@Req() req: any) {
    await this.authService.logoutAll(req.user.id);
    return { message: 'Todas las sesiones cerradas' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Req() req: any) {
    return {
      id: req.user.id.toString(),
      email: req.user.email,
      nombre: req.user.nombre,
      apellido: req.user.apellido,
      roles: req.user.roles,
      organizacionId: req.user.organizacionId,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify')
  async verify() {
    return { valid: true };
  }
}
