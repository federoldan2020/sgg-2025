import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

export interface AuditContext {
  usuarioId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CrearOrganizacionDto {
  nombre: string;
  activo?: boolean;
}

export interface ActualizarOrganizacionDto {
  nombre?: string;
  activo?: boolean;
}

@Injectable()
export class OrganizacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listar() {
    return this.prisma.organizacion.findMany({
      where: {},
      select: {
        id: true,
        nombre: true,
        activo: true,
        creadoEn: true,
        _count: { select: { usuarios: true } },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  async obtenerPorId(id: string) {
    const org = await this.prisma.organizacion.findUnique({
      where: { id },
      include: {
        _count: { select: { usuarios: true, afiliados: true } },
      },
    });
    if (!org) throw new NotFoundException('Organización no encontrada');
    return org;
  }

  async crear(dto: CrearOrganizacionDto, auditCtx?: AuditContext) {
    const existente = await this.prisma.organizacion.findUnique({
      where: { nombre: dto.nombre },
    });
    if (existente) {
      throw new BadRequestException('Ya existe una organización con ese nombre');
    }
    const org = await this.prisma.organizacion.create({
      data: {
        nombre: dto.nombre,
        activo: dto.activo ?? true,
      },
    });
    if (auditCtx) {
      await this.audit.log({
        usuarioId: auditCtx.usuarioId,
        accion: 'ORGANIZACION_CREAR',
        entidad: 'Organizacion',
        entidadId: org.id,
        payloadDespues: { nombre: org.nombre, activo: org.activo },
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
      });
    }
    return org;
  }

  async actualizar(id: string, dto: ActualizarOrganizacionDto, auditCtx?: AuditContext) {
    const org = await this.obtenerPorId(id);
    if (dto.nombre && dto.nombre !== org.nombre) {
      const existente = await this.prisma.organizacion.findUnique({
        where: { nombre: dto.nombre },
      });
      if (existente) {
        throw new BadRequestException('Ya existe una organización con ese nombre');
      }
    }
    const orgActualizada = await this.prisma.organizacion.update({
      where: { id },
      data: dto,
    });
    if (auditCtx) {
      await this.audit.log({
        usuarioId: auditCtx.usuarioId,
        organizacionId: id,
        accion: 'ORGANIZACION_ACTUALIZAR',
        entidad: 'Organizacion',
        entidadId: id,
        payloadDespues: { nombre: orgActualizada.nombre, activo: orgActualizada.activo },
        ipAddress: auditCtx.ipAddress,
        userAgent: auditCtx.userAgent,
      });
    }
    return orgActualizada;
  }

  async listarUsuarios(organizacionId: string) {
    const org = await this.prisma.organizacion.findUnique({
      where: { id: organizacionId },
    });
    if (!org) throw new NotFoundException('Organización no encontrada');

    return this.prisma.usuario.findMany({
      where: { organizacionId },
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
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });
  }
}
