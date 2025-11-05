import { Injectable } from '@nestjs/common';
import prisma from '../../prisma';
import type {
  CrearReglaBaseDto,
  EditarReglaBaseDto,
  CrearReglaColateralDto,
  EditarReglaColateralDto,
} from './dtos';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReglasService {
  // ===== BASE COSEGURO =====
  listarBase(orgId: string) {
    return prisma.reglaPrecioCoseguro.findMany({
      where: { organizacionId: orgId },
      orderBy: [{ activo: 'desc' }, { vigenteDesde: 'desc' }],
    });
  }

  crearBase(orgId: string, dto: CrearReglaBaseDto) {
    return prisma.reglaPrecioCoseguro.create({
      data: {
        organizacionId: orgId,
        vigenteDesde: new Date(dto.vigenteDesde),
        vigenteHasta: dto.vigenteHasta ? new Date(dto.vigenteHasta) : null,
        precioBase: new Prisma.Decimal(dto.precioBase),
        activo: dto.activo ?? true,
      },
    });
  }

  editarBase(orgId: string, id: string, dto: EditarReglaBaseDto) {
    const rid = BigInt(id);
    return prisma.reglaPrecioCoseguro.update({
      where: { id: rid },
      data: {
        vigenteHasta:
          dto.vigenteHasta === undefined
            ? undefined
            : dto.vigenteHasta
              ? new Date(dto.vigenteHasta)
              : null,
        precioBase: dto.precioBase !== undefined ? new Prisma.Decimal(dto.precioBase) : undefined,
        activo: dto.activo ?? undefined,
      },
    });
  }

  eliminarBase(orgId: string, id: string) {
    return prisma.reglaPrecioCoseguro.delete({ where: { id: BigInt(id) } });
  }

  // ===== COLATERALES (por parentesco + tramo) =====
  async listarColaterales(orgId: string) {
    return prisma.reglaPrecioColateral.findMany({
      where: { organizacionId: orgId },
      include: { parentesco: true },
      orderBy: [
        { activo: 'desc' },
        { parentescoId: 'asc' },
        { vigenteDesde: 'desc' },
        { cantidadDesde: 'asc' },
      ],
    });
  }

  async crearColateral(orgId: string, dto: CrearReglaColateralDto) {
    const par = await prisma.parentesco.findUnique({
      where: {
        organizacionId_codigo_parentesco: { organizacionId: orgId, codigo: dto.parentescoCodigo },
      },
      select: { id: true },
    });
    if (!par) throw new Error('Parentesco inexistente');

    return prisma.reglaPrecioColateral.create({
      data: {
        organizacionId: orgId,
        parentescoId: par.id,
        cantidadDesde: dto.cantidadDesde,
        cantidadHasta: dto.cantidadHasta ?? null,
        vigenteDesde: new Date(dto.vigenteDesde),
        vigenteHasta: dto.vigenteHasta ? new Date(dto.vigenteHasta) : null,
        precioTotal: new Prisma.Decimal(dto.precioTotal),
        activo: dto.activo ?? true,
      },
    });
  }

  editarColateral(orgId: string, id: string, dto: EditarReglaColateralDto) {
    const rid = BigInt(id);
    return prisma.reglaPrecioColateral.update({
      where: { id: rid },
      data: {
        cantidadDesde: dto.cantidadDesde ?? undefined,
        cantidadHasta: dto.cantidadHasta === undefined ? undefined : dto.cantidadHasta,
        vigenteHasta:
          dto.vigenteHasta === undefined
            ? undefined
            : dto.vigenteHasta
              ? new Date(dto.vigenteHasta)
              : null,
        precioTotal:
          dto.precioTotal !== undefined ? new Prisma.Decimal(dto.precioTotal) : undefined,
        activo: dto.activo ?? undefined,
      },
    });
  }

  eliminarColateral(orgId: string, id: string) {
    return prisma.reglaPrecioColateral.delete({ where: { id: BigInt(id) } });
  }
}
