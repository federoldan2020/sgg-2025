import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RolUsuario, EstadoUsuario, Usuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export interface CrearUsuarioDto {
  organizacionId: string;
  email: string;
  username?: string;
  password: string;
  nombre: string;
  apellido: string;
  roles: RolUsuario[];
  sedeId?: string;
  creadoPor?: string;
}

export interface ActualizarUsuarioDto {
  email?: string;
  username?: string;
  nombre?: string;
  apellido?: string;
  roles?: RolUsuario[];
  estado?: EstadoUsuario;
  sedeId?: string;
}

export interface CambiarPasswordDto {
  passwordActual: string;
  passwordNueva: string;
}

export interface ResetPasswordDto {
  usuarioId: string;
  passwordNueva: string;
}

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(dto: CrearUsuarioDto): Promise<Usuario> {
    // Verificar que el email no esté en uso
    const existente = await this.prisma.usuario.findUnique({
      where: {
        organizacionId_email: {
          organizacionId: dto.organizacionId,
          email: dto.email,
        },
      },
    });

    if (existente) {
      throw new BadRequestException('El email ya está en uso');
    }

    // Verificar username si se proporciona
    if (dto.username) {
      const existenteUsername = await this.prisma.usuario.findUnique({
        where: {
          organizacionId_username: {
            organizacionId: dto.organizacionId,
            username: dto.username,
          },
        },
      });

      if (existenteUsername) {
        throw new BadRequestException('El username ya está en uso');
      }
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.usuario.create({
      data: {
        organizacionId: dto.organizacionId,
        email: dto.email,
        username: dto.username,
        passwordHash,
        nombre: dto.nombre,
        apellido: dto.apellido,
        roles: dto.roles,
        sedeId: dto.sedeId,
        creadoPor: dto.creadoPor ? BigInt(dto.creadoPor) : null,
        estado: EstadoUsuario.PENDIENTE_ACTIVACION,
        cambiarPassword: true,
      },
    });
  }

  async listar(organizacionId: string, filtros?: {
    estado?: EstadoUsuario;
    roles?: RolUsuario[];
    busqueda?: string;
  }) {
    const where: any = { organizacionId };

    if (filtros?.estado) {
      where.estado = filtros.estado;
    }

    if (filtros?.roles && filtros.roles.length > 0) {
      where.roles = { hasSome: filtros.roles };
    }

    if (filtros?.busqueda) {
      where.OR = [
        { nombre: { contains: filtros.busqueda, mode: 'insensitive' } },
        { apellido: { contains: filtros.busqueda, mode: 'insensitive' } },
        { email: { contains: filtros.busqueda, mode: 'insensitive' } },
      ];
    }

    return this.prisma.usuario.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        nombre: true,
        apellido: true,
        roles: true,
        estado: true,
        ultimoLogin: true,
        creadoEn: true,
        sedeId: true,
      },
      orderBy: [
        { apellido: 'asc' },
        { nombre: 'asc' },
      ],
    });
  }

  async obtenerPorId(id: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({
      where: { id: BigInt(id) },
    });
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto): Promise<Usuario> {
    const usuario = await this.obtenerPorId(id);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar email único si se cambia
    if (dto.email && dto.email !== usuario.email) {
      const existente = await this.prisma.usuario.findUnique({
        where: {
          organizacionId_email: {
            organizacionId: usuario.organizacionId,
            email: dto.email,
          },
        },
      });

      if (existente) {
        throw new BadRequestException('El email ya está en uso');
      }
    }

    // Verificar username único si se cambia
    if (dto.username && dto.username !== usuario.username) {
      const existente = await this.prisma.usuario.findUnique({
        where: {
          organizacionId_username: {
            organizacionId: usuario.organizacionId,
            username: dto.username,
          },
        },
      });

      if (existente) {
        throw new BadRequestException('El username ya está en uso');
      }
    }

    return this.prisma.usuario.update({
      where: { id: BigInt(id) },
      data: dto,
    });
  }

  async cambiarPassword(usuarioId: string, dto: CambiarPasswordDto): Promise<void> {
    const usuario = await this.obtenerPorId(usuarioId);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar contraseña actual
    const passwordValida = await bcrypt.compare(dto.passwordActual, usuario.passwordHash);
    if (!passwordValida) {
      throw new BadRequestException('Contraseña actual incorrecta');
    }

    // Hash nueva contraseña
    const passwordHash = await bcrypt.hash(dto.passwordNueva, 12);

    await this.prisma.usuario.update({
      where: { id: BigInt(usuarioId) },
      data: {
        passwordHash,
        cambiarPassword: false, // Ya no necesita cambiar password
      },
    });

    // Invalidar todas las sesiones del usuario
    await this.prisma.sesionUsuario.updateMany({
      where: { usuarioId: BigInt(usuarioId) },
      data: { activa: false },
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const usuario = await this.obtenerPorId(dto.usuarioId);
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Hash nueva contraseña
    const passwordHash = await bcrypt.hash(dto.passwordNueva, 12);

    await this.prisma.usuario.update({
      where: { id: BigInt(dto.usuarioId) },
      data: {
        passwordHash,
        cambiarPassword: true, // Forzar cambio en próximo login
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    });

    // Invalidar todas las sesiones del usuario
    await this.prisma.sesionUsuario.updateMany({
      where: { usuarioId: BigInt(dto.usuarioId) },
      data: { activa: false },
    });
  }

  async activar(id: string): Promise<Usuario> {
    return this.prisma.usuario.update({
      where: { id: BigInt(id) },
      data: { estado: EstadoUsuario.ACTIVO },
    });
  }

  async desactivar(id: string): Promise<Usuario> {
    const usuario = await this.prisma.usuario.update({
      where: { id: BigInt(id) },
      data: { estado: EstadoUsuario.INACTIVO },
    });

    // Invalidar todas las sesiones del usuario
    await this.prisma.sesionUsuario.updateMany({
      where: { usuarioId: BigInt(id) },
      data: { activa: false },
    });

    return usuario;
  }

  async bloquear(id: string, hasta?: Date): Promise<Usuario> {
    return this.prisma.usuario.update({
      where: { id: BigInt(id) },
      data: {
        estado: EstadoUsuario.BLOQUEADO,
        bloqueadoHasta: hasta,
      },
    });
  }

  async eliminar(id: string): Promise<void> {
    // Primero invalidar sesiones
    await this.prisma.sesionUsuario.updateMany({
      where: { usuarioId: BigInt(id) },
      data: { activa: false },
    });

    // Luego eliminar usuario (las sesiones se eliminan por CASCADE)
    await this.prisma.usuario.delete({
      where: { id: BigInt(id) },
    });
  }

  async obtenerSesionesActivas(usuarioId: string) {
    return this.prisma.sesionUsuario.findMany({
      where: {
        usuarioId: BigInt(usuarioId),
        activa: true,
        expiraEn: { gt: new Date() },
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        dispositivo: true,
        creadoEn: true,
        ultimoUso: true,
        expiraEn: true,
      },
      orderBy: { ultimoUso: 'desc' },
    });
  }
}
