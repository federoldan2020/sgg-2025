import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Prisma } from '@prisma/client';
import { calcularJ38ParaAfiliado } from './colaterales-precio.util';

@Injectable()
export class ColateralesCalculoService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Total J38 por afiliado a una fecha. Delega al helper puro
   * `calcularJ38ParaAfiliado` para mantener una única implementación
   * compartida con otros servicios (suspensiones, etc.).
   */
  async calcularTotalJ38(
    organizacionId: string,
    afiliadoId: bigint,
    at: Date,
  ): Promise<Prisma.Decimal> {
    return calcularJ38ParaAfiliado(this.prisma, organizacionId, afiliadoId, at);
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
