// src/modulos/terceros-finanzas/cuentas-extracto.service.ts
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient, RolTercero } from '@prisma/client';

const prisma = new PrismaClient(); // (ideal: singleton compartido)

type ExtractoOpts = {
  organizacionId: string;
  cuentaId: bigint;
  desde?: Date | null;
  hasta?: Date | null;
};

@Injectable()
export class CuentasExtractoService {
  private toNum(v?: Prisma.Decimal | null) {
    return v ? Number(v.toString()) : 0;
  }

  /**
   * Contrato alineado al front:
   * {
   *   cuenta, tercero, desde, hasta,
   *   saldoInicialPeriodo, movimientos[], saldoFinalPeriodo
   * }
   */
  async extractoV2(opts: ExtractoOpts) {
    const { organizacionId, cuentaId } = opts;
    const desde = opts.desde ?? new Date('1900-01-01T00:00:00.000Z');
    const hasta = opts.hasta ?? new Date();

    // Header (incluye tercero)
    const cta = await prisma.cuentaTercero.findUnique({
      where: { id: cuentaId },
      select: {
        id: true,
        organizacionId: true,
        rol: true,
        saldoInicial: true,
        saldoActual: true,
        activo: true,
        terceroId: true,
        tercero: { select: { id: true, nombre: true, cuit: true } },
      },
    });
    if (!cta || cta.organizacionId !== organizacionId) {
      throw new Error('Cuenta inexistente');
    }

    // Saldo inicial del período = último saldoPosterior anterior (si existe),
    // si no, tomo saldoInicial de la cuenta.
    const movPrevio = await prisma.movimientoCuentaTercero.findFirst({
      where: { cuentaId, fecha: { lt: desde } },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      select: { saldoPosterior: true },
    });

    const saldoInicialPeriodo =
      movPrevio?.saldoPosterior != null
        ? this.toNum(movPrevio.saldoPosterior)
        : this.toNum(cta.saldoInicial);

    // Movimientos del rango (en orden)
    const movsDb = await prisma.movimientoCuentaTercero.findMany({
      where: { cuentaId, fecha: { gte: desde, lte: hasta } },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        fecha: true,
        tipo: true, // "debito" | "credito"
        origen: true, // "factura" | "prestacion" | ...
        referenciaId: true,
        detalle: true,
        monto: true,
        saldoPosterior: true, // puede ser null si no lo estabas guardando
      },
    });

    const movimientos = movsDb.map((m) => ({
      id: m.id.toString(),
      fecha: m.fecha.toISOString(),
      tipo: m.tipo as 'debito' | 'credito',
      origen: m.origen,
      referenciaId: m.referenciaId ? m.referenciaId.toString() : null,
      detalle: m.detalle ?? null,
      monto: this.toNum(m.monto),
      saldoPosterior: m.saldoPosterior != null ? this.toNum(m.saldoPosterior) : null,
    }));

    // Saldo final del período = saldoPosterior del último o saldoInicialPeriodo si no hubo
    const saldoFinalPeriodo =
      movimientos.length > 0
        ? (movimientos[movimientos.length - 1].saldoPosterior ?? saldoInicialPeriodo)
        : saldoInicialPeriodo;

    return {
      cuenta: {
        id: cta.id.toString(),
        rol: cta.rol,
        saldoInicial: this.toNum(cta.saldoInicial),
        saldoActual: this.toNum(cta.saldoActual),
        activo: cta.activo,
      },
      tercero: cta.tercero
        ? {
            id: cta.tercero.id.toString(),
            nombre: cta.tercero.nombre,
            cuit: cta.tercero.cuit ?? null,
          }
        : null,
      desde: desde.toISOString(),
      hasta: hasta.toISOString(),
      saldoInicialPeriodo,
      movimientos,
      saldoFinalPeriodo,
    };
  }

  async listarCuentasDeTercero(organizacionId: string, terceroId: bigint, rol: RolTercero | null) {
    const cuentas = await prisma.cuentaTercero.findMany({
      where: { organizacionId, terceroId, ...(rol ? { rol } : {}) },
      orderBy: [{ rol: 'asc' }],
      select: {
        id: true,
        rol: true,
        activo: true,
        saldoInicial: true,
        saldoActual: true,
      },
    });

    const ter = await prisma.tercero.findUnique({
      where: { id: terceroId },
      select: { id: true, nombre: true, cuit: true },
    });

    return {
      tercero: ter ? { id: ter.id.toString(), nombre: ter.nombre, cuit: ter.cuit ?? null } : null,
      cuentas: cuentas.map((c) => ({
        id: c.id.toString(),
        rol: c.rol,
        activo: c.activo,
        saldoInicial: this.toNum(c.saldoInicial),
        saldoActual: this.toNum(c.saldoActual),
      })),
    };
  }
}
