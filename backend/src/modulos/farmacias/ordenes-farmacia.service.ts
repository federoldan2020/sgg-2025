import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

/**
 * Servicio de órdenes de farmacia.
 *
 * Modelo del cupo:
 *   - El cupo es del afiliado titular (no del integrante).
 *   - `ReglaCoberturaCoseguro.ordenesPorMes` vigente define cuántas hay por mes.
 *   - `OrdenFarmaciaConsumo` registra cada consumo con clave única
 *     (organizacionId, afiliadoTitularId, periodo='YYYYMM', numeroOrdenEnMes).
 *   - El reset el día 1 es implícito: al cambiar el periodo cambia la
 *     ventana de cuenta.
 *
 * Validaciones al consumir:
 *   - Titular tiene coseguro J22 ACTIVO (sino no puede usar órdenes).
 *   - Si el consumidor es un integrante, debe estar activo + pertenecer al
 *     grupo del titular.
 *   - Cupo del mes > 0.
 *   - Farmacia activa.
 */
@Injectable()
export class OrdenesFarmaciaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve YYYYMM del mes corriente o de la fecha dada. */
  periodoDe(fecha = new Date()): string {
    const y = fecha.getUTCFullYear();
    const m = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    return `${y}${m}`;
  }

  /** Cupo vigente + consumidas + disponibles para un titular en un periodo. */
  async getSaldo(
    organizacionId: string,
    afiliadoTitularId: string | number | bigint,
    periodo?: string,
  ) {
    const aid = BigInt(afiliadoTitularId);
    await this.assertAfiliadoEnOrg(organizacionId, aid);

    const per = (periodo ?? this.periodoDe()).slice(0, 6);
    if (!/^\d{6}$/.test(per)) throw new BadRequestException('periodo inválido, esperado YYYYMM');

    const fecha = new Date(Number(per.slice(0, 4)), Number(per.slice(4, 6)) - 1, 1);
    const regla = await this.prisma.reglaCoberturaCoseguro.findFirst({
      where: {
        organizacionId,
        activo: true,
        vigenteDesde: { lte: fecha },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }],
      },
      orderBy: { vigenteDesde: 'desc' },
      select: { ordenesPorMes: true },
    });

    const cupo = regla?.ordenesPorMes ?? 0;
    const usadas = await this.prisma.ordenFarmaciaConsumo.count({
      where: {
        organizacionId,
        afiliadoTitularId: aid,
        periodo: per,
        anuladaEn: null,
      },
    });

    return {
      periodo: per,
      cupo,
      consumidas: usadas,
      disponibles: Math.max(0, cupo - usadas),
    };
  }

  /** Lista los consumos (no anulados + anulados) del periodo. */
  async listarConsumos(
    organizacionId: string,
    afiliadoTitularId: string | number | bigint,
    periodo?: string,
  ) {
    const aid = BigInt(afiliadoTitularId);
    await this.assertAfiliadoEnOrg(organizacionId, aid);
    const per = (periodo ?? this.periodoDe()).slice(0, 6);

    const rows = await this.prisma.ordenFarmaciaConsumo.findMany({
      where: { organizacionId, afiliadoTitularId: aid, periodo: per },
      orderBy: { numeroOrdenEnMes: 'asc' },
      include: {
        farmacia: { select: { id: true, codigo: true, nombre: true, esInterna: true } },
        integrante: { select: { id: true, nombre: true, dni: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      numeroOrdenEnMes: r.numeroOrdenEnMes,
      consumidaEn: r.consumidaEn.toISOString(),
      monto: r.monto != null ? Number(r.monto) : null,
      observacion: r.observacion,
      anuladaEn: r.anuladaEn?.toISOString() ?? null,
      anuladaPor: r.anuladaPor,
      anuladaMotivo: r.anuladaMotivo,
      farmacia: r.farmacia
        ? { id: r.farmacia.id.toString(), codigo: r.farmacia.codigo, nombre: r.farmacia.nombre, esInterna: r.farmacia.esInterna }
        : null,
      integrante: r.integrante
        ? { id: r.integrante.id.toString(), nombre: r.integrante.nombre, dni: r.integrante.dni }
        : null,
    }));
  }

  /** Consume una orden. Transaccional. */
  async consumir(params: {
    organizacionId: string;
    afiliadoTitularId: string | number | bigint;
    integranteColateralId?: string | number | bigint | null;
    farmaciaId: string | number | bigint;
    monto?: number | null;
    observacion?: string | null;
    fecha?: Date;
  }) {
    const aid = BigInt(params.afiliadoTitularId);
    const fid = BigInt(params.farmaciaId);
    const integranteId = params.integranteColateralId
      ? BigInt(params.integranteColateralId)
      : null;
    const fecha = params.fecha ?? new Date();
    const periodo = this.periodoDe(fecha);

    // Validar coseguro activo del titular
    const cos = await this.prisma.coseguroAfiliado.findFirst({
      where: { organizacionId: params.organizacionId, afiliadoId: aid },
      select: { estado: true },
    });
    if (!cos || cos.estado !== 'activo') {
      throw new ForbiddenException(
        'El titular no tiene coseguro J22 activo — no puede consumir órdenes',
      );
    }

    // Validar integrante (si vino) — debe ser activo y del titular
    if (integranteId != null) {
      const integ = await this.prisma.colateral.findFirst({
        where: { id: integranteId, afiliadoId: aid, activo: true },
        select: { id: true },
      });
      if (!integ) {
        throw new BadRequestException(
          'Integrante inválido: no pertenece al grupo familiar o está inactivo',
        );
      }
    }

    // Validar farmacia activa + misma org
    const far = await this.prisma.farmacia.findFirst({
      where: { id: fid, organizacionId: params.organizacionId, activo: true },
      select: { id: true },
    });
    if (!far) throw new BadRequestException('Farmacia inválida o inactiva');

    return this.prisma.$transaction(async (tx) => {
      // Lock-friendly: tomamos cupo vigente
      const regla = await tx.reglaCoberturaCoseguro.findFirst({
        where: {
          organizacionId: params.organizacionId,
          activo: true,
          vigenteDesde: { lte: fecha },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }],
        },
        orderBy: { vigenteDesde: 'desc' },
        select: { ordenesPorMes: true },
      });
      const cupo = regla?.ordenesPorMes ?? 0;
      if (cupo <= 0) throw new BadRequestException('No hay regla de cobertura vigente');

      const usadas = await tx.ordenFarmaciaConsumo.count({
        where: {
          organizacionId: params.organizacionId,
          afiliadoTitularId: aid,
          periodo,
          anuladaEn: null,
        },
      });
      if (usadas >= cupo) {
        throw new ForbiddenException(`Cupo del mes agotado (${usadas}/${cupo})`);
      }

      const numeroOrdenEnMes = usadas + 1;
      const consumo = await tx.ordenFarmaciaConsumo.create({
        data: {
          organizacionId: params.organizacionId,
          afiliadoTitularId: aid,
          integranteColateralId: integranteId,
          periodo,
          numeroOrdenEnMes,
          farmaciaId: fid,
          consumidaEn: fecha,
          monto: params.monto != null ? params.monto : null,
          observacion: params.observacion ?? null,
        },
        select: { id: true, numeroOrdenEnMes: true, periodo: true, consumidaEn: true },
      });

      return {
        id: consumo.id.toString(),
        numeroOrdenEnMes: consumo.numeroOrdenEnMes,
        periodo: consumo.periodo,
        consumidaEn: consumo.consumidaEn.toISOString(),
        cupo,
        consumidas: numeroOrdenEnMes,
        disponibles: cupo - numeroOrdenEnMes,
      };
    });
  }

  /** Anula un consumo. Requiere motivo. */
  async anular(params: {
    organizacionId: string;
    consumoId: string | number | bigint;
    motivo: string;
    actorLabel: string; // ej 'usuario:xxx' o 'farmacia:yyy'
  }) {
    const cid = BigInt(params.consumoId);
    const motivo = (params.motivo ?? '').trim();
    if (motivo.length < 3) throw new BadRequestException('Motivo requerido');

    const c = await this.prisma.ordenFarmaciaConsumo.findFirst({
      where: { id: cid, organizacionId: params.organizacionId },
      select: { id: true, anuladaEn: true },
    });
    if (!c) throw new NotFoundException('Consumo no encontrado');
    if (c.anuladaEn) throw new BadRequestException('El consumo ya estaba anulado');

    await this.prisma.ordenFarmaciaConsumo.update({
      where: { id: cid },
      data: {
        anuladaEn: new Date(),
        anuladaPor: params.actorLabel,
        anuladaMotivo: motivo,
      },
    });
    return { ok: true as const };
  }

  // ===== helpers
  private async assertAfiliadoEnOrg(organizacionId: string, afiliadoId: bigint) {
    const ok = await this.prisma.afiliado.findFirst({
      where: { id: afiliadoId, organizacionId },
      select: { id: true },
    });
    if (!ok) throw new NotFoundException('Afiliado no encontrado en la organización');
  }
}
