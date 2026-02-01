import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { RolUsuario, EstadoUsuario, Usuario } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export interface CrearUsuarioDto {
  organizacionId?: string;
  email: string;
  username?: string;
  password: string;
  nombre: string;
  apellido: string;
  roles: RolUsuario[];
  sedeId?: string;
  creadoPor?: string;
}

export interface AuditContext {
  usuarioId: string;
  organizacionId: string;
  ipAddress?: string;
  userAgent?: string;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** ADMIN usa su org; SUPERADMIN puede pasar organizacionId por query/body */
  resolverOrganizacionId(param: string | undefined, user: Usuario): string {
    const isSuperadmin = user.roles.includes(RolUsuario.SUPERADMIN);
    if (isSuperadmin && param) return param;
    return user.organizacionId;
  }

  private async validarOrgUsuario(usuario: Usuario, currentUser: Usuario): Promise<void> {
    if (currentUser.roles.includes(RolUsuario.SUPERADMIN)) return;
    if (usuario.organizacionId !== currentUser.organizacionId) {
      throw new ForbiddenException('No tienes permisos para este usuario');
    }
  }

  async crear(dto: CrearUsuarioDto, auditCtx?: AuditContext): Promise<Usuario> {
    const orgId = dto.organizacionId;
    if (!orgId) throw new BadRequestException('organizacionId es requerido');
    // Verificar que el email no esté en uso
    const existente = await this.prisma.usuario.findUnique({
      where: {
        organizacionId_email: {
          organizacionId: orgId,
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
            organizacionId: orgId,
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

    const usuario = await this.prisma.usuario.create({
      data: {
        organizacionId: orgId,
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

    if (auditCtx) {
      await this.audit.log({
        ...auditCtx,
        organizacionId: orgId,
        accion: 'USUARIO_CREAR',
        entidad: 'Usuario',
        entidadId: usuario.id.toString(),
        payloadDespues: { email: usuario.email, nombre: usuario.nombre, roles: usuario.roles },
      });
    }
    return usuario;
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

  async obtenerPorId(id: string, currentUser?: Usuario): Promise<Usuario | null> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: BigInt(id) },
    });
    if (usuario && currentUser) await this.validarOrgUsuario(usuario, currentUser);
    return usuario;
  }

  async actualizar(id: string, dto: ActualizarUsuarioDto, currentUser?: Usuario): Promise<Usuario> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: BigInt(id) } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (currentUser) await this.validarOrgUsuario(usuario, currentUser);

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

  async resetPassword(dto: ResetPasswordDto, currentUser?: Usuario): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: BigInt(dto.usuarioId) } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (currentUser) await this.validarOrgUsuario(usuario, currentUser);

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

  async activar(id: string, currentUser?: Usuario): Promise<Usuario> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: BigInt(id) } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (currentUser) await this.validarOrgUsuario(usuario, currentUser);
    return this.prisma.usuario.update({
      where: { id: BigInt(id) },
      data: { estado: EstadoUsuario.ACTIVO },
    });
  }

  async desactivar(id: string, currentUser?: Usuario): Promise<Usuario> {
    const usuarioAntes = await this.prisma.usuario.findUnique({ where: { id: BigInt(id) } });
    if (!usuarioAntes) throw new NotFoundException('Usuario no encontrado');
    if (currentUser) await this.validarOrgUsuario(usuarioAntes, currentUser);
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

  async bloquear(id: string, hasta?: Date, currentUser?: Usuario): Promise<Usuario> {
    const usuarioAntes = await this.prisma.usuario.findUnique({ where: { id: BigInt(id) } });
    if (!usuarioAntes) throw new NotFoundException('Usuario no encontrado');
    if (currentUser) await this.validarOrgUsuario(usuarioAntes, currentUser);
    return this.prisma.usuario.update({
      where: { id: BigInt(id) },
      data: {
        estado: EstadoUsuario.BLOQUEADO,
        bloqueadoHasta: hasta,
      },
    });
  }

  async eliminar(id: string, currentUser?: Usuario): Promise<void> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id: BigInt(id) } });
    if (!usuario) throw new NotFoundException('Usuario no encontrado');
    if (currentUser) await this.validarOrgUsuario(usuario, currentUser);
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

  async obtenerSesionesActivas(usuarioId: string, currentUser?: Usuario) {
    if (currentUser && usuarioId !== currentUser.id.toString()) {
      const usuario = await this.prisma.usuario.findUnique({ where: { id: BigInt(usuarioId) } });
      if (usuario) await this.validarOrgUsuario(usuario, currentUser);
    }
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
