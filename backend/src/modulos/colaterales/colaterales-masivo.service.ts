import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ColateralesCalculoService } from './colaterales-calculo.service';

@Injectable()
export class ColateralesMasivoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calc: ColateralesCalculoService,
  ) {}

  /**
   * Recalcula J38 para todos los afiliados de la organización con
   * colaterales activos. Con el modelo nuevo de novedades, el delta vs el
   * último envío se detecta al momento de generar el lote — no hace falta
   * encolar eventos.
   */
  async recalcularJ38Desde(
    organizacionId: string,
    fechaEfecto: Date,
    opts?: { pageSize?: number },
  ) {
    const pageSize = Math.min(Math.max(opts?.pageSize ?? 500, 50), 2000);

    let lastId: bigint | null = null;
    let procesados = 0;
    for (;;) {
      const afiliados = await this.prisma.afiliado.findMany({
        where: { organizacionId, ...(lastId ? { id: { gt: lastId } } : {}) },
        orderBy: { id: 'asc' },
        take: pageSize,
        select: { id: true },
      });
      if (!afiliados.length) break;

      for (const a of afiliados) {
        const afiId: bigint = BigInt(a.id);
        const hasActivos = await this.prisma.colateral.count({
          where: { afiliadoId: afiId, activo: true, esColateral: true },
        });
        if (!hasActivos) continue;

        // Calculo se mantiene (útil para invalidar caches / disparar
        // futuros workers), pero ya no se persiste como evento puntual.
        await this.calc.calcularTotalJ38(organizacionId, afiId, fechaEfecto);
        procesados++;
      }

      lastId = afiliados[afiliados.length - 1].id as unknown as bigint;
      if (afiliados.length < pageSize) break;
    }

    return { ok: true, procesados };
  }
}
