import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ColateralesCalculoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Total J38 por afiliado a una fecha (suma por parentesco aplicando tramos y vigencias). */
  async calcularTotalJ38(
    organizacionId: string, // se usa para reglas; el colateral se filtra por afiliadoId
    afiliadoId: bigint,
    at: Date,
  ): Promise<Prisma.Decimal> {
    const Decimal = Prisma.Decimal;
    let total = new Decimal(0);

    // Colaterales activos del afiliado que participan en J38
    const colats = await this.prisma.colateral.findMany({
      where: { afiliadoId, activo: true, esColateral: true }, // ❌ sin organizacionId
      select: { parentescoId: true },
    });
    if (!colats.length) return total;

    // Cantidad por parentesco
    const porParentesco = new Map<bigint, number>();
    for (const c of colats) {
      const key = BigInt(c.parentescoId);
      porParentesco.set(key, (porParentesco.get(key) ?? 0) + 1);
    }

    // Reglas vigentes a la fecha (sí filtran por organización)
    const reglas = await this.prisma.reglaPrecioColateral.findMany({
      where: {
        organizacionId,
        activo: true,
        vigenteDesde: { lte: at },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: at } }],
      },
      select: {
        parentescoId: true,
        cantidadDesde: true,
        cantidadHasta: true,
        precioTotal: true,
        vigenteDesde: true,
        id: true,
      },
    });

    for (const [pid, cant] of porParentesco.entries()) {
      const candidatas = reglas.filter(
        (r) =>
          r.parentescoId === pid &&
          cant >= r.cantidadDesde &&
          (r.cantidadHasta == null || cant <= r.cantidadHasta),
      );
      if (!candidatas.length) continue;

      candidatas.sort((a, b) => {
        if (b.cantidadDesde !== a.cantidadDesde) return b.cantidadDesde - a.cantidadDesde;
        const ad = a.vigenteDesde.getTime(),
          bd = b.vigenteDesde.getTime();
        if (bd !== ad) return bd - ad;
        return Number(b.id - a.id);
      });

      total = total.plus(candidatas[0].precioTotal);
    }

    return total;
  }

  async listPadronesActivos(organizacionId: string, afiliadoId: bigint) {
    return this.prisma.padron.findMany({
      where: { organizacionId, afiliadoId, activo: true },
      select: { id: true, padron: true, activo: true, sistema: true, centro: true },
      orderBy: { id: 'asc' },
    });
  }

  async getPadronDestino(organizacionId: string, afiliadoId: bigint) {
    const p = await this.listPadronesActivos(organizacionId, afiliadoId);
    return p[0]?.id ?? null;
  }
}
