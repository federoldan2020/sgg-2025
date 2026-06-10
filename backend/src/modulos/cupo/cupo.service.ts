import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

/**
 * Servicio para calcular el cupo de crédito disponible de un afiliado.
 *
 * Modelo:
 *   - **cupoTotal**: suma de `Padron.cupo` para todos los padrones ACTIVOS
 *     del afiliado en la organización. (Permite multi-padrón: un docente
 *     activo en una escuela + jubilado, cada padrón puede tener cupo propio).
 *   - **cupoUsado**: suma de saldos de Obligaciones K16 abiertas
 *     (`concepto.codigo='ORDEN_CREDITO'`, estado pendiente|parcial, saldo>0).
 *     Incluye obligaciones bloqueadas (ya enviadas a Cómputos pero todavía
 *     no descontadas).
 *   - **cupoDisponible**: max(0, cupoTotal - cupoUsado).
 *
 * El cupo NO bloquea servicios de salud (eso lo manejan los gates de J22/J38).
 * Sólo restringe la creación de NUEVAS órdenes de crédito.
 */

export type DetalleOrdenAbierta = {
  ordenId: string;
  fechaAlta: Date;
  cantidadCuotas: number | null;
  comercioRazonSocial: string | null;
  importeTotal: number;
  saldoTotal: number;
  cuotasPendientes: number;
};

export type CupoResult = {
  organizacionId: string;
  afiliadoId: string;
  cupoTotal: number;
  cupoUsado: number;
  cupoDisponible: number;
  porcentajeUsado: number; // 0-100
  cantidadOrdenesAbiertas: number;
  detalleOrdenes: DetalleOrdenAbierta[];
};

@Injectable()
export class CupoService {
  constructor(private readonly prisma: PrismaService) {}

  async calcular(organizacionId: string, afiliadoId: bigint): Promise<CupoResult> {
    const afiliado = await this.prisma.afiliado.findFirst({
      where: { id: afiliadoId, organizacionId },
      select: { id: true },
    });
    if (!afiliado) throw new NotFoundException('Afiliado no encontrado en la organización');

    // 1) Cupo total = suma de cupos de padrones activos.
    const padronesActivos = await this.prisma.padron.findMany({
      where: { organizacionId, afiliadoId, activo: true },
      select: { cupo: true },
    });
    const cupoTotal = padronesActivos.reduce((acc, p) => acc + Number(p.cupo ?? 0), 0);

    // 2) Cupo usado = saldos K16 abiertos.
    const conceptoK16 = await this.prisma.concepto.findFirst({
      where: { organizacionId, codigo: 'ORDEN_CREDITO' },
      select: { id: true },
    });
    let cupoUsado = 0;
    if (conceptoK16) {
      const obls = await this.prisma.obligacion.findMany({
        where: {
          organizacionId,
          afiliadoId,
          conceptoId: conceptoK16.id,
          estado: { in: ['pendiente', 'parcialmente_pagada'] },
          saldo: { gt: 0 },
        },
        select: { saldo: true },
      });
      cupoUsado = obls.reduce((acc, o) => acc + Number(o.saldo ?? 0), 0);
    }

    // 3) Detalle de órdenes abiertas (para la UI).
    const ordenes = await this.prisma.ordenCredito.findMany({
      where: {
        organizacionId,
        afiliadoId,
        estado: { in: ['pendiente', 'en_curso'] },
      },
      orderBy: { fechaAlta: 'desc' },
      include: {
        comercio: { select: { razonSocial: true } },
        cuotas: {
          select: { estado: true, saldo: true },
        },
      },
    });
    const detalleOrdenes: DetalleOrdenAbierta[] = ordenes.map((o) => ({
      ordenId: o.id.toString(),
      fechaAlta: o.fechaAlta,
      cantidadCuotas: o.cantidadCuotas ?? null,
      comercioRazonSocial: o.comercio?.razonSocial ?? null,
      importeTotal: Number(o.importeTotal ?? 0),
      saldoTotal: Number(o.saldoTotal ?? 0),
      cuotasPendientes: o.cuotas.filter(
        (c) => c.estado !== 'pagada' && c.estado !== 'anulada' && Number(c.saldo) > 0,
      ).length,
    }));

    const cupoDisponible = Math.max(0, cupoTotal - cupoUsado);
    const porcentajeUsado =
      cupoTotal > 0 ? Math.min(100, (cupoUsado / cupoTotal) * 100) : 0;

    return {
      organizacionId,
      afiliadoId: afiliadoId.toString(),
      cupoTotal,
      cupoUsado,
      cupoDisponible,
      porcentajeUsado,
      cantidadOrdenesAbiertas: ordenes.length,
      detalleOrdenes,
    };
  }

  /**
   * Validación previa a crear una orden: chequea si el `nuevoImporte` (total
   * de la orden a crear) entra en el cupo disponible. Lanza error si no.
   */
  async asegurarCupoSuficiente(
    organizacionId: string,
    afiliadoId: bigint,
    nuevoImporte: number,
  ): Promise<void> {
    const cupo = await this.calcular(organizacionId, afiliadoId);
    if (cupo.cupoDisponible + 0.01 < nuevoImporte) {
      throw new NotFoundException(
        `Cupo insuficiente: disponible ${cupo.cupoDisponible.toFixed(2)}, requerido ${nuevoImporte.toFixed(2)}.`,
      );
    }
  }
}
