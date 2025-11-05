import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Comercio } from '@prisma/client';
import { PrismaService } from 'src/common/prisma.service';

@Injectable()
export class ComerciosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: Prisma.ComercioCreateInput): Promise<Comercio> {
    const exists = await this.prisma.comercio.findFirst({
      where: { organizacionId: dto.organizacionId, codigo: dto.codigo },
      select: { id: true },
    });
    if (exists) throw new BadRequestException('Código ya existe para la organización');
    const created = await this.prisma.comercio.create({ data: dto });
    return created;
  }

  async update(
    id: bigint,
    organizacionId: string,
    dto: Prisma.ComercioUpdateInput,
  ): Promise<Comercio> {
    const row = await this.prisma.comercio.findFirst({ where: { id, organizacionId } });
    if (!row) throw new NotFoundException('Comercio no encontrado');
    const updated = await this.prisma.comercio.update({ where: { id }, data: dto });
    return updated;
  }

  async get(id: bigint, organizacionId: string): Promise<Comercio> {
    const row = await this.prisma.comercio.findFirst({ where: { id, organizacionId } });
    if (!row) throw new NotFoundException('Comercio no encontrado');
    return row;
  }

  async search(organizacionId: string, q?: string): Promise<Comercio[]> {
    const where: Prisma.ComercioWhereInput = q?.trim()
      ? {
          organizacionId,
          OR: [{ baja: { equals: false } }, { baja: { equals: null } }],
          AND: [
            {
              OR: [
                { codigo: { contains: q, mode: 'insensitive' } },
                { razonSocial: { contains: q, mode: 'insensitive' } },
                { cuit: { contains: q, mode: 'insensitive' } },
              ],
            },
          ],
        }
      : {
          organizacionId,
          OR: [{ baja: { equals: false } }, { baja: { equals: null } }],
        };

    const list = await this.prisma.comercio.findMany({
      where,
      orderBy: [{ razonSocial: 'asc' }],
      take: 50,
    });
    return list;
  }

  async softDelete(id: bigint, organizacionId: string): Promise<Comercio> {
    const row = await this.prisma.comercio.findFirst({ where: { id, organizacionId } });
    if (!row) throw new NotFoundException('Comercio no encontrado');
    const updated = await this.prisma.comercio.update({ where: { id }, data: { baja: true } });
    return updated;
  }
}
