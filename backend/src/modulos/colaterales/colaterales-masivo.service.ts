import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ColateralesCalculoService } from './colaterales-calculo.service';
import { NovedadesService } from '../novedades/novedades.service';

@Injectable()
export class ColateralesMasivoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calc: ColateralesCalculoService,
    private readonly novedades: NovedadesService,
  ) {}

  /**
   * Recalcula y encola MODIF J38 para afiliados con colaterales activos
   * a partir de una fecha de efecto.
   */
  async recalcularJ38Desde(
    organizacionId: string,
    fechaEfecto: Date,
    opts?: { pageSize?: number },
  ) {
    const pageSize = Math.min(Math.max(opts?.pageSize ?? 500, 50), 2000);

    let lastId: bigint | null = null;
    for (;;) {
      // Pageamos por afiliados de la organización
      const afiliados = await this.prisma.afiliado.findMany({
        where: { organizacionId, ...(lastId ? { id: { gt: lastId } } : {}) },
        orderBy: { id: 'asc' },
        take: pageSize,
        select: { id: true },
      });
      if (!afiliados.length) break;

      for (const a of afiliados) {
        const afiId: bigint = BigInt(a.id); // ✅ cast explícito para ESLint

        // Verificamos si tiene colaterales activos que participen en J38
        const hasActivos = await this.prisma.colateral.count({
          where: { afiliadoId: afiId, activo: true, esColateral: true },
        });
        if (!hasActivos) continue;

        const total = await this.calc.calcularTotalJ38(organizacionId, afiId, fechaEfecto);
        const padronId = await this.calc.getPadronDestino(organizacionId, afiId);
        if (!padronId) continue;

        await this.novedades.registrarModifColaterales({
          organizacionId,
          afiliadoId: afiId, // ✅ bigint
          padronId, // ✅ bigint
          ocurridoEn: fechaEfecto,
          observacion: `Recalculo masivo reglas colaterales (${fechaEfecto.toISOString().slice(0, 10)})`,
          nuevoTotal: total,
        });
      }

      lastId = afiliados[afiliados.length - 1].id as unknown as bigint;
      if (afiliados.length < pageSize) break;
    }

    return { ok: true };
  }
}
