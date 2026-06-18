import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type { CrearReglaCoberturaDto, EditarReglaCoberturaDto } from './dtos';

@Injectable()
export class ReglasCoberturaService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.reglaCoberturaCoseguro.findMany({
      where: { organizacionId: orgId },
      orderBy: [{ activo: 'desc' }, { vigenteDesde: 'desc' }],
    });
  }

  /** Regla vigente a una fecha (default hoy). */
  async getVigente(orgId: string, fecha?: string) {
    const at = fecha ? new Date(fecha) : new Date();
    return this.prisma.reglaCoberturaCoseguro.findFirst({
      where: {
        organizacionId: orgId,
        activo: true,
        vigenteDesde: { lte: at },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: at } }],
      },
      orderBy: { vigenteDesde: 'desc' },
    });
  }

  create(orgId: string, dto: CrearReglaCoberturaDto) {
    if (!Number.isInteger(dto.ordenesPorMes) || dto.ordenesPorMes <= 0) {
      throw new BadRequestException('ordenesPorMes debe ser entero positivo');
    }
    const desde = new Date(dto.vigenteDesde);
    if (Number.isNaN(desde.getTime())) throw new BadRequestException('vigenteDesde inválida');
    const hasta = dto.vigenteHasta ? new Date(dto.vigenteHasta) : null;
    if (hasta && Number.isNaN(hasta.getTime())) {
      throw new BadRequestException('vigenteHasta inválida');
    }
    if (hasta && hasta < desde) throw new BadRequestException('vigenteHasta < vigenteDesde');

    return this.prisma.reglaCoberturaCoseguro.create({
      data: {
        organizacionId: orgId,
        ordenesPorMes: dto.ordenesPorMes,
        vigenteDesde: desde,
        vigenteHasta: hasta,
        activo: dto.activo ?? true,
      },
    });
  }

  async update(orgId: string, id: string, dto: EditarReglaCoberturaDto) {
    const rid = BigInt(id);
    const existe = await this.prisma.reglaCoberturaCoseguro.findFirst({
      where: { id: rid, organizacionId: orgId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('Regla de cobertura no encontrada');

    if (
      dto.ordenesPorMes != null &&
      (!Number.isInteger(dto.ordenesPorMes) || dto.ordenesPorMes <= 0)
    ) {
      throw new BadRequestException('ordenesPorMes debe ser entero positivo');
    }
    let hasta: Date | null | undefined = undefined;
    if (dto.vigenteHasta !== undefined) {
      hasta = dto.vigenteHasta ? new Date(dto.vigenteHasta) : null;
      if (hasta && Number.isNaN(hasta.getTime())) {
        throw new BadRequestException('vigenteHasta inválida');
      }
    }

    return this.prisma.reglaCoberturaCoseguro.update({
      where: { id: rid },
      data: {
        ...(dto.ordenesPorMes != null ? { ordenesPorMes: dto.ordenesPorMes } : {}),
        ...(hasta !== undefined ? { vigenteHasta: hasta } : {}),
        ...(dto.activo != null ? { activo: dto.activo } : {}),
      },
    });
  }

  async remove(orgId: string, id: string) {
    const rid = BigInt(id);
    const existe = await this.prisma.reglaCoberturaCoseguro.findFirst({
      where: { id: rid, organizacionId: orgId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('Regla de cobertura no encontrada');
    await this.prisma.reglaCoberturaCoseguro.delete({ where: { id: rid } });
    return { ok: true as const };
  }
}
