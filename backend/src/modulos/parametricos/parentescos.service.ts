import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type { CrearParentescoDto, EditarParentescoDto } from './dtos';

@Injectable()
export class ParentescosService {
  constructor(private prisma: PrismaService) {}

  listar(orgId: string) {
    return this.prisma.parentesco.findMany({
      where: { organizacionId: orgId },
      orderBy: [{ activo: 'desc' }, { codigo: 'asc' }],
    });
  }

  async crear(orgId: string, dto: CrearParentescoDto) {
    return this.prisma.parentesco.create({
      data: {
        organizacionId: orgId,
        codigo: dto.codigo,
        descripcion: dto.descripcion.trim(),
        activo: dto.activo ?? true,
      },
    });
  }

  async editar(orgId: string, id: bigint | number, dto: EditarParentescoDto) {
    const pid = typeof id === 'number' ? BigInt(id) : id;
    return this.prisma.parentesco.update({
      where: { id: pid },
      data: {
        descripcion: dto.descripcion?.trim(),
        activo: dto.activo ?? undefined,
      },
    });
  }

  eliminar(orgId: string, id: bigint | number) {
    const pid = typeof id === 'number' ? BigInt(id) : id;
    return this.prisma.parentesco.delete({ where: { id: pid } });
  }
}
