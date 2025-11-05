import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateReglaJ22Dto, UpdateReglaJ22Dto } from './dtos';

@Injectable()
export class CoseguroReglasService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureDates(dto: { vigenteDesde: string; vigenteHasta?: string | null }) {
    const desde = new Date(dto.vigenteDesde);
    if (isNaN(desde.getTime())) throw new BadRequestException('vigenteDesde inválida');
    const hasta =
      dto.vigenteHasta === '' || dto.vigenteHasta == null ? null : new Date(dto.vigenteHasta);
    if (hasta && isNaN(hasta.getTime())) throw new BadRequestException('vigenteHasta inválida');
    if (hasta && hasta < desde) throw new BadRequestException('vigenteHasta < vigenteDesde');
    return { desde, hasta };
  }

  async list(organizacionId: string, params: { activo?: boolean } = {}) {
    const where: any = {
      organizacionId,
      ...(params.activo == null ? {} : { activo: params.activo }),
    };
    return this.prisma.reglaPrecioCoseguro.findMany({
      where,
      orderBy: [{ vigenteDesde: 'desc' }],
    });
  }

  async create(organizacionId: string, dto: CreateReglaJ22Dto) {
    const { desde, hasta } = this.ensureDates(dto);
    return this.prisma.reglaPrecioCoseguro.create({
      data: {
        organizacionId,
        vigenteDesde: desde,
        vigenteHasta: hasta,
        precioBase: Number(dto.precioBase),
        activo: dto.activo ?? true,
      },
    });
  }

  async get(organizacionId: string, id: string) {
    const row = await this.prisma.reglaPrecioCoseguro.findFirst({
      where: { organizacionId, id: BigInt(id) },
    });
    if (!row) throw new NotFoundException('Regla no encontrada');
    return row;
  }

  async update(organizacionId: string, id: string, dto: UpdateReglaJ22Dto) {
    let fechas: { desde?: Date; hasta?: Date | null } = {};
    if (dto.vigenteDesde || dto.vigenteHasta !== undefined) {
      const curr = await this.get(organizacionId, id);
      const baseDesde = dto.vigenteDesde ?? curr.vigenteDesde.toISOString().slice(0, 10);
      const baseHasta = dto.vigenteHasta ?? curr.vigenteHasta?.toISOString().slice(0, 10) ?? null;
      const { desde, hasta } = this.ensureDates({
        vigenteDesde: baseDesde,
        vigenteHasta: baseHasta ?? undefined,
      });
      fechas = { desde, hasta };
    }

    const data: any = {
      ...(dto.precioBase != null ? { precioBase: Number(dto.precioBase) } : {}),
      ...(dto.vigenteDesde != null ? { vigenteDesde: fechas.desde } : {}),
      ...(dto.vigenteHasta !== undefined ? { vigenteHasta: fechas.hasta ?? null } : {}),
      ...(dto.activo != null ? { activo: !!dto.activo } : {}),
    };

    return this.prisma.reglaPrecioCoseguro.update({
      where: { id: BigInt(id) },
      data,
    });
  }

  async toggle(organizacionId: string, id: string, activo: boolean) {
    await this.get(organizacionId, id);
    return this.prisma.reglaPrecioCoseguro.update({
      where: { id: BigInt(id) },
      data: { activo: !!activo },
      select: { id: true, activo: true },
    });
  }

  async remove(organizacionId: string, id: string) {
    await this.get(organizacionId, id);
    await this.prisma.reglaPrecioCoseguro.delete({ where: { id: BigInt(id) } });
    return { ok: true };
  }
}
