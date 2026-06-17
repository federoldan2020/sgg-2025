import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type {
  CrearReglaBaseDto,
  EditarReglaBaseDto,
  CrearReglaColateralDto,
  EditarReglaColateralDto,
} from './dtos';
import { Prisma } from '@prisma/client';

@Injectable()
export class ReglasService {
  constructor(private prisma: PrismaService) {}

  // ===== BASE COSEGURO =====
  listarBase(orgId: string) {
    return this.prisma.reglaPrecioCoseguro.findMany({
      where: { organizacionId: orgId },
      orderBy: [{ activo: 'desc' }, { vigenteDesde: 'desc' }],
    });
  }

  crearBase(orgId: string, dto: CrearReglaBaseDto) {
    return this.prisma.reglaPrecioCoseguro.create({
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
    return this.prisma.reglaPrecioCoseguro.update({
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
    return this.prisma.reglaPrecioCoseguro.delete({ where: { id: BigInt(id) } });
  }

  // ===== COLATERALES (por parentesco + tramo) =====
  async listarColaterales(orgId: string) {
    return this.prisma.reglaPrecioColateral.findMany({
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
    // Validar precio: exactamente uno de precioPorColateral / precioTotal.
    const tienePorCol = dto.precioPorColateral != null;
    const tieneTotal = dto.precioTotal != null;
    if (tienePorCol === tieneTotal) {
      throw new Error(
        'Debe enviar exactamente uno de precioPorColateral o precioTotal',
      );
    }

    // parentescoCodigo opcional: si viene resuelve a id; si no, comodín (null).
    let parentescoId: bigint | null = null;
    if (dto.parentescoCodigo != null) {
      const par = await this.prisma.parentesco.findUnique({
        where: {
          organizacionId_codigo_parentesco: {
            organizacionId: orgId,
            codigo: dto.parentescoCodigo,
          },
        },
        select: { id: true },
      });
      if (!par) throw new Error('Parentesco inexistente');
      parentescoId = par.id;
    }

    return this.prisma.reglaPrecioColateral.create({
      data: {
        organizacionId: orgId,
        parentescoId,
        cantidadDesde: dto.cantidadDesde,
        cantidadHasta: dto.cantidadHasta ?? null,
        vigenteDesde: new Date(dto.vigenteDesde),
        vigenteHasta: dto.vigenteHasta ? new Date(dto.vigenteHasta) : null,
        precioPorColateral:
          dto.precioPorColateral != null ? new Prisma.Decimal(dto.precioPorColateral) : null,
        precioTotal: dto.precioTotal != null ? new Prisma.Decimal(dto.precioTotal) : null,
        activo: dto.activo ?? true,
      },
    });
  }

  async editarColateral(orgId: string, id: string, dto: EditarReglaColateralDto) {
    const rid = BigInt(id);

    // Resolver parentescoCodigo si vino (incluye null explícito → comodín).
    let parentescoIdUpdate: bigint | null | undefined = undefined;
    if (dto.parentescoCodigo !== undefined) {
      if (dto.parentescoCodigo === null) {
        parentescoIdUpdate = null;
      } else {
        const par = await this.prisma.parentesco.findUnique({
          where: {
            organizacionId_codigo_parentesco: {
              organizacionId: orgId,
              codigo: dto.parentescoCodigo,
            },
          },
          select: { id: true },
        });
        if (!par) throw new Error('Parentesco inexistente');
        parentescoIdUpdate = par.id;
      }
    }

    return this.prisma.reglaPrecioColateral.update({
      where: { id: rid },
      data: {
        parentescoId: parentescoIdUpdate,
        cantidadDesde: dto.cantidadDesde ?? undefined,
        cantidadHasta: dto.cantidadHasta === undefined ? undefined : dto.cantidadHasta,
        vigenteHasta:
          dto.vigenteHasta === undefined
            ? undefined
            : dto.vigenteHasta
              ? new Date(dto.vigenteHasta)
              : null,
        precioPorColateral:
          dto.precioPorColateral === undefined
            ? undefined
            : dto.precioPorColateral === null
              ? null
              : new Prisma.Decimal(dto.precioPorColateral),
        precioTotal:
          dto.precioTotal === undefined
            ? undefined
            : dto.precioTotal === null
              ? null
              : new Prisma.Decimal(dto.precioTotal),
        activo: dto.activo ?? undefined,
      },
    });
  }

  eliminarColateral(orgId: string, id: string) {
    return this.prisma.reglaPrecioColateral.delete({ where: { id: BigInt(id) } });
  }
}
