import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { CoberturaService } from './cobertura.service';

/**
 * Estados del afiliado (formaliza el string `Afiliado.estado`):
 *   activo | suspendido_provisorio | suspendido_firme | baja | baja_incobrable
 */
export const ESTADOS_AFILIADO = {
  ACTIVO: 'activo',
  SUSP_PROVISORIO: 'suspendido_provisorio',
  SUSP_FIRME: 'suspendido_firme',
  BAJA: 'baja',
  BAJA_INCOBRABLE: 'baja_incobrable',
} as const;

const ESTADOS_SUSPENDIDO = new Set<string>([
  ESTADOS_AFILIADO.SUSP_PROVISORIO,
  ESTADOS_AFILIADO.SUSP_FIRME,
]);

@Injectable()
export class SuspensionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cobertura: CoberturaService,
  ) {}

  /** Indica si el afiliado está actualmente suspendido (provisorio o firme). */
  async estaSuspendido(organizacionId: string, afiliadoId: bigint): Promise<boolean> {
    const a = await this.prisma.afiliado.findFirst({
      where: { organizacionId, id: afiliadoId },
      select: { estado: true },
    });
    return !!a && ESTADOS_SUSPENDIDO.has(a.estado);
  }

  /** ¿Tiene excepción ADMIN vigente que lo libera del cierre automático? */
  async tieneExcepcionVigente(organizacionId: string, afiliadoId: bigint): Promise<boolean> {
    const hoy = new Date();
    const exc = await this.prisma.afiliadoExcepcionSuspension.findFirst({
      where: {
        organizacionId,
        afiliadoId,
        activa: true,
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: hoy } }],
      },
      select: { id: true },
    });
    return !!exc;
  }

  /**
   * Marca al afiliado como suspendido provisorio por el período en mora.
   * No genera novedad a Cómputos: la suspensión es estrictamente interna.
   */
  async suspender(
    organizacionId: string,
    afiliadoId: bigint,
    periodoOrigen: string,
    opts: { usuarioId?: string; observacion?: string; estadoInicial?: 'provisoria' | 'firme' } = {},
  ) {
    const afiliado = await this.prisma.afiliado.findFirst({
      where: { organizacionId, id: afiliadoId },
    });
    if (!afiliado) throw new NotFoundException('Afiliado no encontrado');

    if (ESTADOS_SUSPENDIDO.has(afiliado.estado)) {
      return { yaSuspendido: true, afiliadoId: afiliado.id.toString() };
    }

    if (await this.tieneExcepcionVigente(organizacionId, afiliadoId)) {
      throw new ForbiddenException(
        'El afiliado tiene una excepción ADMIN activa: no puede ser suspendido automáticamente',
      );
    }

    const estadoInicial = opts.estadoInicial ?? 'provisoria';
    const nuevoEstadoAfiliado =
      estadoInicial === 'firme' ? ESTADOS_AFILIADO.SUSP_FIRME : ESTADOS_AFILIADO.SUSP_PROVISORIO;

    const result = await this.prisma.$transaction(async (tx) => {
      const susp = await tx.afiliadoSuspension.create({
        data: {
          organizacionId,
          afiliadoId,
          periodoOrigen,
          estado: estadoInicial,
          fechaFirme: estadoInicial === 'firme' ? new Date() : null,
          creadoPorId: opts.usuarioId,
          observacion: opts.observacion,
        },
      });
      await tx.afiliado.update({
        where: { id: afiliadoId },
        data: { estado: nuevoEstadoAfiliado },
      });
      return susp;
    });

    await this.audit.log({
      organizacionId,
      usuarioId: opts.usuarioId,
      accion: 'AFILIADO_SUSPENDER',
      entidad: 'Afiliado',
      entidadId: afiliadoId.toString(),
      metadata: { periodoOrigen, suspensionId: result.id.toString(), estado: estadoInicial },
    });

    return { suspensionId: result.id.toString(), afiliadoId: afiliadoId.toString() };
  }

  /**
   * Rehabilita al afiliado si la deuda de los períodos en mora quedó saldada.
   *   motivo: pago_caja | cobranza_periodo | excepcion_admin | reversion_admin
   */
  async rehabilitar(
    organizacionId: string,
    afiliadoId: bigint,
    motivo: string,
    opts: { usuarioId?: string; forzar?: boolean } = {},
  ) {
    const afiliado = await this.prisma.afiliado.findFirst({
      where: { organizacionId, id: afiliadoId },
    });
    if (!afiliado) throw new NotFoundException('Afiliado no encontrado');
    if (!ESTADOS_SUSPENDIDO.has(afiliado.estado)) {
      return { yaActivo: true, afiliadoId: afiliado.id.toString() };
    }

    // Suspensiones abiertas
    const abiertas = await this.prisma.afiliadoSuspension.findMany({
      where: { organizacionId, afiliadoId, fechaFin: null },
      orderBy: { fechaInicio: 'asc' },
    });

    // Rehabilitación exige saldar J17 de los períodos en mora.
    // J22/J38 NO bloquean la rehabilitación del afiliado: tienen sus propios
    // gates dinámicos. K16 tampoco: actúa sobre el cupo, no sobre el estado.
    if (!opts.forzar) {
      for (const s of abiertas) {
        const cob = await this.cobertura.obtener(organizacionId, afiliadoId, s.periodoOrigen);
        if (!cob.j17Cubierto) {
          throw new BadRequestException(
            `No se puede rehabilitar: el J17 del período ${s.periodoOrigen} sigue con deuda`,
          );
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.afiliadoSuspension.updateMany({
        where: { organizacionId, afiliadoId, fechaFin: null },
        data: {
          estado: 'rehabilitada',
          fechaFin: new Date(),
          motivoFin: motivo,
          finalizadoPorId: opts.usuarioId ?? null,
        },
      });
      await tx.afiliado.update({
        where: { id: afiliadoId },
        data: { estado: ESTADOS_AFILIADO.ACTIVO },
      });
    });

    await this.audit.log({
      organizacionId,
      usuarioId: opts.usuarioId,
      accion: 'AFILIADO_REHABILITAR',
      entidad: 'Afiliado',
      entidadId: afiliadoId.toString(),
      metadata: { motivo, suspensionesCerradas: abiertas.length, forzado: !!opts.forzar },
    });

    return { afiliadoId: afiliadoId.toString(), cerradas: abiertas.length };
  }

  /**
   * Reversión administrativa (sólo durante la ventana de gracia, o ADMIN
   * decide saltearla). Cierra la suspensión sin exigir que esté saldada.
   */
  async revertir(
    organizacionId: string,
    afiliadoId: bigint,
    motivo: string,
    usuarioId?: string,
  ) {
    const susp = await this.prisma.afiliadoSuspension.findFirst({
      where: { organizacionId, afiliadoId, fechaFin: null },
      orderBy: { fechaInicio: 'desc' },
    });
    if (!susp) throw new NotFoundException('No hay suspensión activa para revertir');

    await this.prisma.$transaction(async (tx) => {
      await tx.afiliadoSuspension.update({
        where: { id: susp.id },
        data: {
          estado: 'revertida',
          fechaFin: new Date(),
          motivoFin: 'reversion_admin',
          finalizadoPorId: usuarioId ?? null,
          observacion: motivo,
        },
      });
      await tx.afiliado.update({
        where: { id: afiliadoId },
        data: { estado: ESTADOS_AFILIADO.ACTIVO },
      });
    });

    await this.audit.log({
      organizacionId,
      usuarioId,
      accion: 'AFILIADO_REVERTIR_SUSPENSION',
      entidad: 'Afiliado',
      entidadId: afiliadoId.toString(),
      metadata: { motivo, suspensionId: susp.id.toString() },
    });

    return { afiliadoId: afiliadoId.toString(), suspensionId: susp.id.toString() };
  }

  /**
   * Día 16: convierte a `firme` las suspensiones que estén `provisoria` con
   * más de 5 días de antigüedad y siguen abiertas.
   */
  async convertirProvisoriasAFirmes(organizacionId: string) {
    const corte = new Date();
    corte.setDate(corte.getDate() - 5);

    const susps = await this.prisma.afiliadoSuspension.findMany({
      where: {
        organizacionId,
        estado: 'provisoria',
        fechaFin: null,
        fechaInicio: { lte: corte },
      },
    });

    if (susps.length === 0) return { convertidas: 0 };

    const ids = susps.map((s) => s.id);
    const afiliadoIds = susps.map((s) => s.afiliadoId);

    await this.prisma.$transaction([
      this.prisma.afiliadoSuspension.updateMany({
        where: { id: { in: ids } },
        data: { estado: 'firme', fechaFirme: new Date() },
      }),
      this.prisma.afiliado.updateMany({
        where: { id: { in: afiliadoIds }, organizacionId, estado: ESTADOS_AFILIADO.SUSP_PROVISORIO },
        data: { estado: ESTADOS_AFILIADO.SUSP_FIRME },
      }),
    ]);

    await this.audit.log({
      organizacionId,
      accion: 'SUSPENSIONES_CONVERTIR_FIRMES',
      entidad: 'AfiliadoSuspension',
      metadata: { cantidad: susps.length },
    });

    return { convertidas: susps.length };
  }

  /** Historial de suspensiones del afiliado, más reciente primero. */
  async historial(organizacionId: string, afiliadoId: bigint) {
    const items = await this.prisma.afiliadoSuspension.findMany({
      where: { organizacionId, afiliadoId },
      orderBy: { fechaInicio: 'desc' },
    });
    return items.map((s) => ({
      ...s,
      id: s.id.toString(),
      afiliadoId: s.afiliadoId.toString(),
    }));
  }
}
