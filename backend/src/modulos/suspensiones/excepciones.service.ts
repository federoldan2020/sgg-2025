import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

const ROLES_PERMITIDOS = new Set(['ADMIN', 'SUPERADMIN']);

export type UsuarioCtx = { id: string; roles: string[] };

@Injectable()
export class ExcepcionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private requireAdmin(usuario?: UsuarioCtx) {
    if (!usuario || !usuario.roles?.some((r) => ROLES_PERMITIDOS.has(r))) {
      throw new ForbiddenException('Sólo ADMIN o SUPERADMIN puede gestionar excepciones');
    }
  }

  async crear(
    organizacionId: string,
    afiliadoId: bigint,
    motivo: string,
    vigenciaHasta: Date | null,
    usuario: UsuarioCtx,
  ) {
    this.requireAdmin(usuario);

    const af = await this.prisma.afiliado.findFirst({
      where: { organizacionId, id: afiliadoId },
      select: { id: true },
    });
    if (!af) throw new NotFoundException('Afiliado no encontrado');

    // Desactiva excepciones previas activas (sólo una vigente a la vez).
    await this.prisma.afiliadoExcepcionSuspension.updateMany({
      where: { organizacionId, afiliadoId, activa: true },
      data: {
        activa: false,
        desactivadoEn: new Date(),
        desactivadoPorId: usuario.id,
      },
    });

    const creada = await this.prisma.afiliadoExcepcionSuspension.create({
      data: {
        organizacionId,
        afiliadoId,
        motivo,
        vigenciaHasta,
        creadoPorId: usuario.id,
      },
    });

    await this.audit.log({
      organizacionId,
      usuarioId: usuario.id,
      accion: 'EXCEPCION_SUSPENSION_CREAR',
      entidad: 'AfiliadoExcepcionSuspension',
      entidadId: creada.id.toString(),
      metadata: { afiliadoId: afiliadoId.toString(), motivo, vigenciaHasta },
    });

    return { ...creada, id: creada.id.toString(), afiliadoId: afiliadoId.toString() };
  }

  async desactivar(organizacionId: string, excepcionId: bigint, usuario: UsuarioCtx) {
    this.requireAdmin(usuario);
    const exc = await this.prisma.afiliadoExcepcionSuspension.findFirst({
      where: { organizacionId, id: excepcionId, activa: true },
    });
    if (!exc) throw new NotFoundException('Excepción no encontrada o ya inactiva');

    await this.prisma.afiliadoExcepcionSuspension.update({
      where: { id: exc.id },
      data: {
        activa: false,
        desactivadoEn: new Date(),
        desactivadoPorId: usuario.id,
      },
    });

    await this.audit.log({
      organizacionId,
      usuarioId: usuario.id,
      accion: 'EXCEPCION_SUSPENSION_DESACTIVAR',
      entidad: 'AfiliadoExcepcionSuspension',
      entidadId: exc.id.toString(),
    });

    return { ok: true };
  }

  async listarPorAfiliado(organizacionId: string, afiliadoId: bigint) {
    const items = await this.prisma.afiliadoExcepcionSuspension.findMany({
      where: { organizacionId, afiliadoId },
      orderBy: { creadoEn: 'desc' },
    });
    return items.map((e) => ({
      ...e,
      id: e.id.toString(),
      afiliadoId: e.afiliadoId.toString(),
    }));
  }

  async listarActivas(organizacionId: string) {
    const hoy = new Date();
    const items = await this.prisma.afiliadoExcepcionSuspension.findMany({
      where: {
        organizacionId,
        activa: true,
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: hoy } }],
      },
      include: {
        afiliado: { select: { id: true, dni: true, apellido: true, nombre: true } },
      },
      orderBy: { creadoEn: 'desc' },
    });
    return items.map((e) => ({
      ...e,
      id: e.id.toString(),
      afiliadoId: e.afiliadoId.toString(),
      afiliado: {
        ...e.afiliado,
        id: e.afiliado.id.toString(),
        dni: e.afiliado.dni.toString(),
      },
    }));
  }
}
