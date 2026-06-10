import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CoberturaService } from './cobertura.service';
import { SuspensionesService } from './suspensiones.service';

/**
 * GateService: API consultada por otros módulos antes de habilitar un servicio.
 *
 * Modelo de gates separados (bloque 2 de decisiones, doc CIRCUITO_AFILIADOS):
 *
 *   1. Afiliado activo (J17) → habilita: comercios, órdenes de crédito,
 *      servicios sociales, coseguro y reintegros (capa base).
 *   2. Coseguro habilitado (J22) → AFILIADO ACTIVO
 *                                + CERO obligaciones J22 abiertas
 *                                + J22 del mes corriente cubierto.
 *   3. Colaterales habilitados (J38) → COSEGURO HABILITADO
 *                                    + CERO obligaciones J38 abiertas
 *                                    + J38 del mes corriente cubierto.
 *   4. K16 no participa de los gates; afecta solamente cupo.
 */

export type GateResult = { permitido: boolean; razon?: string };

// Códigos de Concepto en BD ↔ códigos funcionales del modelo.
const CONCEPTO_CODIGO_J22 = 'COSEGURO';
const CONCEPTO_CODIGO_J38 = 'ADIC_COL';

@Injectable()
export class GateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cobertura: CoberturaService,
    private readonly suspensiones: SuspensionesService,
  ) {}

  /**
   * Coseguro: requiere afiliado activo + cero obligaciones J22 abiertas
   * + J22 del mes corriente cubierto (obligación pagada o no aplica).
   */
  async puedeUsarCoseguro(organizacionId: string, afiliadoId: bigint): Promise<GateResult> {
    if (await this.suspensiones.estaSuspendido(organizacionId, afiliadoId)) {
      return { permitido: false, razon: 'afiliado_suspendido' };
    }

    // 1) Sin deudas históricas J22 (decisión 14').
    const deudaJ22 = await this.tieneObligacionAbierta(
      organizacionId,
      afiliadoId,
      CONCEPTO_CODIGO_J22,
    );
    if (deudaJ22) {
      return { permitido: false, razon: 'j22_deuda_historica_abierta' };
    }

    // 2) Mes corriente cubierto.
    const periodo = this.periodoActual();
    const cob = await this.cobertura.obtener(organizacionId, afiliadoId, periodo);
    if (!cob.j22Cubierto) {
      return { permitido: false, razon: 'j22_no_cobrado_periodo_actual' };
    }
    return { permitido: true };
  }

  /**
   * Colaterales: requiere coseguro habilitado + cero obligaciones J38 abiertas
   * + J38 del mes corriente cubierto.
   */
  async puedeUsarColaterales(organizacionId: string, afiliadoId: bigint): Promise<GateResult> {
    const coseguro = await this.puedeUsarCoseguro(organizacionId, afiliadoId);
    if (!coseguro.permitido) return coseguro;

    const deudaJ38 = await this.tieneObligacionAbierta(
      organizacionId,
      afiliadoId,
      CONCEPTO_CODIGO_J38,
    );
    if (deudaJ38) {
      return { permitido: false, razon: 'j38_deuda_historica_abierta' };
    }

    const periodo = this.periodoActual();
    const cob = await this.cobertura.obtener(organizacionId, afiliadoId, periodo);
    if (!cob.j38Cubierto) {
      return { permitido: false, razon: 'j38_no_cobrado_periodo_actual' };
    }
    return { permitido: true };
  }

  /**
   * Reintegros: mismas condiciones que coseguro, evaluadas sobre el período
   * de la prestación (no el corriente). Si no se pasa período, evalúa actual.
   */
  async puedeReintegrar(
    organizacionId: string,
    afiliadoId: bigint,
    periodoPrestacion?: string,
  ): Promise<GateResult> {
    if (await this.suspensiones.estaSuspendido(organizacionId, afiliadoId)) {
      return { permitido: false, razon: 'afiliado_suspendido' };
    }
    const deudaJ22 = await this.tieneObligacionAbierta(
      organizacionId,
      afiliadoId,
      CONCEPTO_CODIGO_J22,
    );
    if (deudaJ22) {
      return { permitido: false, razon: 'j22_deuda_historica_abierta' };
    }
    const periodo = periodoPrestacion ?? this.periodoActual();
    const cob = await this.cobertura.obtener(organizacionId, afiliadoId, periodo);
    if (!cob.j22Cubierto) {
      return { permitido: false, razon: 'j22_no_cobrado_periodo_prestacion' };
    }
    return { permitido: true };
  }

  /** Sólo requiere afiliado activo (cuota societaria al día). */
  async puedeOrdenCredito(organizacionId: string, afiliadoId: bigint): Promise<GateResult> {
    if (await this.suspensiones.estaSuspendido(organizacionId, afiliadoId)) {
      return { permitido: false, razon: 'afiliado_suspendido' };
    }
    return { permitido: true };
  }

  /** Comercios: afiliado activo. */
  async puedeComprarEnComercio(organizacionId: string, afiliadoId: bigint): Promise<GateResult> {
    if (await this.suspensiones.estaSuspendido(organizacionId, afiliadoId)) {
      return { permitido: false, razon: 'afiliado_suspendido' };
    }
    return { permitido: true };
  }

  /** Helper para módulos que prefieren lanzar excepción. */
  ensureOrThrow(result: GateResult, mensaje?: string) {
    if (!result.permitido) {
      throw new ForbiddenException(mensaje ?? `Operación bloqueada: ${result.razon}`);
    }
  }

  /**
   * ¿El afiliado tiene alguna Obligacion del código indicado con saldo > 0?
   * Si no existe el Concepto en la base, considera "sin deuda".
   */
  private async tieneObligacionAbierta(
    organizacionId: string,
    afiliadoId: bigint,
    codigoConcepto: string,
  ): Promise<boolean> {
    const concepto = await this.prisma.concepto.findFirst({
      where: { organizacionId, codigo: codigoConcepto },
      select: { id: true },
    });
    if (!concepto) return false;
    const existe = await this.prisma.obligacion.findFirst({
      where: {
        organizacionId,
        afiliadoId,
        conceptoId: concepto.id,
        estado: { in: ['pendiente', 'parcialmente_pagada'] },
        saldo: { gt: 0 },
      },
      select: { id: true },
    });
    return !!existe;
  }

  private periodoActual(): string {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}
