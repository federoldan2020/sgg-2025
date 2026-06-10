import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

/**
 * Gestiona los parámetros de cobertura del circuito de suspensiones, con
 * vigencias temporales para no reescribir corridas pasadas:
 *   - ParametroJ17Minimo:  mínimo de cobertura para Activos/Jub/PP.
 *   - ParametroJ17Cuota04: monto de cuota mensual para afiliados tipo 04.
 *
 * `getVigente` resuelve el valor que estaba en vigencia en una fecha
 * cualquiera (clave para que reportes históricos no muten).
 */

type Tipo = 'J17_MINIMO' | 'J17_CUOTA_04';

@Injectable()
export class ParametrosService {
  constructor(private readonly prisma: PrismaService) {}

  private modelFor(tipo: Tipo) {
    return tipo === 'J17_MINIMO'
      ? this.prisma.parametroJ17Minimo
      : this.prisma.parametroJ17Cuota04;
  }

  /** Devuelve el historial completo, más reciente primero. */
  async listar(organizacionId: string, tipo: Tipo) {
    const items = await (this.modelFor(tipo) as any).findMany({
      where: { organizacionId },
      orderBy: { vigenteDesde: 'desc' },
    });
    return items.map((i: any) => ({
      ...i,
      id: i.id.toString(),
      valor: Number(i.valor),
    }));
  }

  /** Valor vigente en una fecha dada. Default: hoy. */
  async getVigente(organizacionId: string, fecha: Date = new Date(), tipo: Tipo) {
    const fechaSolo = new Date(fecha.toISOString().slice(0, 10));
    const v = await (this.modelFor(tipo) as any).findFirst({
      where: {
        organizacionId,
        vigenteDesde: { lte: fechaSolo },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaSolo } }],
      },
      orderBy: { vigenteDesde: 'desc' },
    });
    return v ? { ...v, id: v.id.toString(), valor: Number(v.valor) } : null;
  }

  /**
   * Crea una nueva vigencia. Cierra automáticamente la anterior con
   * `vigenteHasta = vigenteDesde nueva - 1 día`.
   */
  async crear(
    organizacionId: string,
    tipo: Tipo,
    valor: number,
    vigenteDesde: Date,
    usuarioId?: string,
  ) {
    if (valor < 0) throw new BadRequestException('El valor no puede ser negativo');
    const desde = new Date(vigenteDesde.toISOString().slice(0, 10));

    return this.prisma.$transaction(async (tx) => {
      const model = (tipo === 'J17_MINIMO' ? tx.parametroJ17Minimo : tx.parametroJ17Cuota04) as any;

      // Cierra la vigencia anterior si no está cerrada.
      const previa = await model.findFirst({
        where: { organizacionId, vigenteHasta: null },
        orderBy: { vigenteDesde: 'desc' },
      });
      if (previa) {
        if (previa.vigenteDesde >= desde) {
          throw new BadRequestException(
            'La nueva vigencia debe ser posterior a la última registrada',
          );
        }
        const cierre = new Date(desde);
        cierre.setUTCDate(cierre.getUTCDate() - 1);
        await model.update({
          where: { id: previa.id },
          data: { vigenteHasta: cierre },
        });
      }

      const creada = await model.create({
        data: {
          organizacionId,
          valor,
          vigenteDesde: desde,
          creadoPorId: usuarioId,
        },
      });
      return { ...creada, id: creada.id.toString(), valor: Number(creada.valor) };
    });
  }

  async eliminarUltima(organizacionId: string, tipo: Tipo) {
    const model = this.modelFor(tipo) as any;
    const ultima = await model.findFirst({
      where: { organizacionId },
      orderBy: { vigenteDesde: 'desc' },
    });
    if (!ultima) throw new NotFoundException('No hay vigencias registradas');
    await model.delete({ where: { id: ultima.id } });

    // Reabre la anterior si existía.
    const anterior = await model.findFirst({
      where: { organizacionId },
      orderBy: { vigenteDesde: 'desc' },
    });
    if (anterior) {
      await model.update({
        where: { id: anterior.id },
        data: { vigenteHasta: null },
      });
    }
    return { ok: true };
  }
}
