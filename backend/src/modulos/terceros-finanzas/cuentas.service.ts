// src/modulos/terceros-finanzas/cuentas.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma, RolTercero } from '@prisma/client';

// helper Decimal seguro
const D = (v: Prisma.Decimal | number | string | null | undefined) => new Prisma.Decimal(v ?? 0);

const prisma = new PrismaClient();

@Injectable()
export class CuentasService {
  async ensureCuenta(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    terceroId: bigint,
    rol: RolTercero,
  ): Promise<bigint> {
    const c = await tx.cuentaTercero.findFirst({
      where: { organizacionId, terceroId, rol },
      select: { id: true },
    });
    if (c) return c.id;
    const n = await tx.cuentaTercero.create({
      data: { organizacionId, terceroId, rol, activo: true },
      select: { id: true },
    });
    return n.id;
  }

  /**
   * Aplica movimiento (debito/credito) y actualiza saldo con saldoPosterior.
   * Devuelve {saldoAnterior, saldoPosterior}
   */
  async moverSaldo(
    tx: Prisma.TransactionClient,
    cuentaId: bigint,
    monto: Prisma.Decimal | number | string,
    tipo: 'debito' | 'credito',
    origen: 'factura' | 'prestacion' | 'nota_credito' | 'nota_debito' | 'orden_pago' | 'ajuste',
    referenciaId?: bigint | number | string | null,
    detalle?: string | null,
    fecha?: Date | null,
  ) {
    const cta = await tx.cuentaTercero.findUnique({
      where: { id: cuentaId },
      select: { saldoActual: true },
    });

    const prev = D(cta?.saldoActual);
    const delta = D(monto).mul(tipo === 'debito' ? 1 : -1);
    const nuevo = prev.add(delta);

    await tx.movimientoCuentaTercero.create({
      data: {
        cuentaId,
        fecha: fecha ?? new Date(),
        tipo,
        origen,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        referenciaId: referenciaId != null ? BigInt(referenciaId as any) : null,
        detalle: detalle ?? null,
        monto: D(monto),
        saldoPosterior: nuevo, // 👈 queda persistido
      },
    });

    await tx.cuentaTercero.update({
      where: { id: cuentaId },
      data: { saldoActual: nuevo }, // 👈 saldo vivo
    });
  }

  async getSaldoActual(cuentaId: bigint) {
    const c = await prisma.cuentaTercero.findUnique({
      where: { id: cuentaId },
      select: { saldoActual: true },
    });
    return D(c?.saldoActual?.toString() ?? 0);
  }
}
