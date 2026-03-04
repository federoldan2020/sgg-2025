import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import * as bcrypt from 'bcryptjs';
import { Usuario, SesionUsuario, RolUsuario, EstadoUsuario } from '@prisma/client';

export interface LoginDto {
  email: string;
  password: string;
  organizacionId: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  usuario: {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    roles: RolUsuario[];
    organizacionId: string;
  };
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface JwtPayload {
  sub: string; // usuario ID
  email: string;
  organizacionId: string;
  roles: RolUsuario[];
  sessionId: string;
  tokenFamily: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponse> {
    // 1. Buscar usuario
    const usuario = await this.prisma.usuario.findUnique({
      where: {
        organizacionId_email: {
          organizacionId: dto.organizacionId,
          email: dto.email,
        },
      },
    });

    if (!usuario) {
      this.logger.warn(
        `Login fallido: usuario no encontrado para email=${dto.email} organizacionId=${dto.organizacionId || '(vacío)'}. Verificá que el usuario exista en esa organización.`,
      );
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 2. Verificar estado del usuario
    if (usuario.estado !== EstadoUsuario.ACTIVO) {
      this.logger.warn(`Login fallido: usuario inactivo o bloqueado id=${usuario.id} email=${dto.email}`);
      throw new UnauthorizedException('Usuario inactivo o bloqueado');
    }

    // 3. Verificar bloqueo temporal
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      this.logger.warn(`Login fallido: usuario bloqueado hasta ${usuario.bloqueadoHasta} id=${usuario.id}`);
      throw new UnauthorizedException('Usuario temporalmente bloqueado');
    }

    // 4. Verificar contraseña
    const passwordValida = await bcrypt.compare(dto.password, usuario.passwordHash);
    if (!passwordValida) {
      this.logger.warn(`Login fallido: contraseña incorrecta para email=${dto.email} organizacionId=${dto.organizacionId}`);
      await this.incrementarIntentosFallidos(usuario.id);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // 5. Resetear intentos fallidos y actualizar último login
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        intentosFallidos: 0,
        bloqueadoHasta: null,
        ultimoLogin: new Date(),
      },
    });

    // 6. Crear sesión y tokens
    const response = await this.crearSesionYTokens(usuario, ipAddress, userAgent);

    // 7. Auditoría de login
    await this.audit.log({
      usuarioId: usuario.id.toString(),
      organizacionId: usuario.organizacionId,
      accion: 'LOGIN',
      entidad: 'Usuario',
      entidadId: usuario.id.toString(),
      ipAddress,
      userAgent,
    });

    return response;
  }

  async refreshToken(dto: RefreshTokenDto): Promise<LoginResponse> {
    // 1. Buscar sesión activa
    const sesion = await this.prisma.sesionUsuario.findUnique({
      where: { refreshToken: dto.refreshToken },
      include: { usuario: true },
    });

    if (!sesion || !sesion.activa || sesion.expiraEn < new Date()) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    // 2. Verificar estado del usuario
    if (sesion.usuario.estado !== EstadoUsuario.ACTIVO) {
      await this.invalidarSesion(sesion.id);
      throw new UnauthorizedException('Usuario inactivo');
    }

    // 3. Rotación: generar nuevo refresh token e invalidar el anterior
    const nuevoRefreshToken = this.generarRefreshToken();
    await this.prisma.sesionUsuario.update({
      where: { id: sesion.id },
      data: {
        refreshToken: nuevoRefreshToken,
        ultimoUso: new Date(),
      },
    });

    // 4. Generar nuevo access token
    const payload: JwtPayload = {
      sub: sesion.usuario.id.toString(),
      email: sesion.usuario.email,
      organizacionId: sesion.usuario.organizacionId,
      roles: sesion.usuario.roles,
      sessionId: sesion.id,
      tokenFamily: sesion.tokenFamily,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      refreshToken: nuevoRefreshToken,
      usuario: {
        id: sesion.usuario.id.toString(),
        email: sesion.usuario.email,
        nombre: sesion.usuario.nombre,
        apellido: sesion.usuario.apellido,
        roles: sesion.usuario.roles,
        organizacionId: sesion.usuario.organizacionId,
      },
    };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.sesionUsuario.updateMany({
      where: { refreshToken },
      data: { activa: false },
    });
  }

  async logoutAll(usuarioId: string): Promise<void> {
    await this.prisma.sesionUsuario.updateMany({
      where: { usuarioId: BigInt(usuarioId) },
      data: { activa: false },
    });
  }

  async validateJwtPayload(payload: JwtPayload): Promise<Usuario | null> {
    // Verificar que la sesión siga activa
    const sesion = await this.prisma.sesionUsuario.findUnique({
      where: { id: payload.sessionId },
      include: { usuario: true },
    });

    if (!sesion || !sesion.activa || sesion.expiraEn < new Date()) {
      return null;
    }

    if (sesion.usuario.estado !== EstadoUsuario.ACTIVO) {
      return null;
    }

    return sesion.usuario;
  }

  private async crearSesionYTokens(
    usuario: Usuario,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResponse> {
    // Generar familia de tokens única
    const tokenFamily = this.generarTokenFamily();
    
    // Crear sesión
    const expiraEn = new Date();
    expiraEn.setDate(expiraEn.getDate() + 30); // Refresh token válido por 30 días

    const sesion = await this.prisma.sesionUsuario.create({
      data: {
        usuarioId: usuario.id,
        organizacionId: usuario.organizacionId,
        refreshToken: this.generarRefreshToken(),
        tokenFamily,
        ipAddress,
        userAgent,
        expiraEn,
      },
    });

    // Generar JWT payload
    const payload: JwtPayload = {
      sub: usuario.id.toString(),
      email: usuario.email,
      organizacionId: usuario.organizacionId,
      roles: usuario.roles,
      sessionId: sesion.id,
      tokenFamily,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      refreshToken: sesion.refreshToken,
      usuario: {
        id: usuario.id.toString(),
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        roles: usuario.roles,
        organizacionId: usuario.organizacionId,
      },
    };
  }

  private async incrementarIntentosFallidos(usuarioId: bigint): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { intentosFallidos: true },
    });

    const nuevosIntentos = (usuario?.intentosFallidos || 0) + 1;
    const datosUpdate: any = { intentosFallidos: nuevosIntentos };

    // Bloquear después de 5 intentos fallidos por 15 minutos
    if (nuevosIntentos >= 5) {
      const bloqueadoHasta = new Date();
      bloqueadoHasta.setMinutes(bloqueadoHasta.getMinutes() + 15);
      datosUpdate.bloqueadoHasta = bloqueadoHasta;
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: datosUpdate,
    });
  }

  private async invalidarSesion(sesionId: string): Promise<void> {
    await this.prisma.sesionUsuario.update({
      where: { id: sesionId },
      data: { activa: false },
    });
  }

  private generarTokenFamily(): string {
    return `fam_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private generarRefreshToken(): string {
    return `rt_${Date.now()}_${Math.random().toString(36).substring(2)}_${Math.random().toString(36).substring(2)}`;
  }

  // Utilidad para limpiar sesiones expiradas (ejecutar periódicamente)
  async limpiarSesionesExpiradas(): Promise<number> {
    const resultado = await this.prisma.sesionUsuario.deleteMany({
      where: {
        OR: [
          { expiraEn: { lt: new Date() } },
          { activa: false },
        ],
      },
    });

    return resultado.count;
  }
}
