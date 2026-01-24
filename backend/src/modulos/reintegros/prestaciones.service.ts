import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import type {
  CrearPrestacionTipoDto,
  EditarPrestacionTipoDto,
  CrearPrestacionSubtipoDto,
  EditarPrestacionSubtipoDto,
  CrearPrestacionPracticaDto,
  EditarPrestacionPracticaDto,
  CrearPrestacionReglaDto,
  EditarPrestacionReglaDto,
} from './prestaciones.dtos';

type IdLike = string | number | bigint;

const toBig = (v: IdLike) => {
  try {
    return typeof v === 'bigint' ? v : BigInt(v);
  } catch {
    throw new BadRequestException('Identificador inválido');
  }
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
  return d;
};

@Injectable()
export class PrestacionesService {
  constructor(private prisma: PrismaService) {}

  // ===== Tipos =====
  listarTipos(organizacionId: string) {
    return this.prisma.prestacionTipo.findMany({
      where: { organizacionId },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  crearTipo(organizacionId: string, dto: CrearPrestacionTipoDto) {
    return this.prisma.prestacionTipo.create({
      data: {
        organizacionId,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        activo: dto.activo ?? true,
        orden: dto.orden ?? null,
      },
    });
  }

  editarTipo(organizacionId: string, id: string, dto: EditarPrestacionTipoDto) {
    const tid = toBig(id);
    return this.prisma.prestacionTipo.update({
      where: { id: tid },
      data: {
        nombre: dto.nombre ?? undefined,
        descripcion: dto.descripcion === undefined ? undefined : dto.descripcion,
        activo: dto.activo ?? undefined,
        orden: dto.orden === undefined ? undefined : dto.orden,
      },
    });
  }

  eliminarTipo(organizacionId: string, id: string) {
    return this.prisma.prestacionTipo.delete({ where: { id: toBig(id) } });
  }

  // ===== Subtipos =====
  listarSubtipos(organizacionId: string, tipoId?: string) {
    return this.prisma.prestacionSubtipo.findMany({
      where: {
        organizacionId,
        ...(tipoId ? { tipoId: toBig(tipoId) } : {}),
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  async crearSubtipo(organizacionId: string, dto: CrearPrestacionSubtipoDto) {
    const tipoId = toBig(dto.tipoId);
    const tipo = await this.prisma.prestacionTipo.findFirst({
      where: { id: tipoId, organizacionId },
      select: { id: true },
    });
    if (!tipo) throw new NotFoundException('Tipo de prestación inexistente');

    return this.prisma.prestacionSubtipo.create({
      data: {
        organizacionId,
        tipoId,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        activo: dto.activo ?? true,
        orden: dto.orden ?? null,
      },
    });
  }

  editarSubtipo(organizacionId: string, id: string, dto: EditarPrestacionSubtipoDto) {
    const sid = toBig(id);
    return this.prisma.prestacionSubtipo.update({
      where: { id: sid },
      data: {
        nombre: dto.nombre ?? undefined,
        descripcion: dto.descripcion === undefined ? undefined : dto.descripcion,
        activo: dto.activo ?? undefined,
        orden: dto.orden === undefined ? undefined : dto.orden,
      },
    });
  }

  eliminarSubtipo(organizacionId: string, id: string) {
    return this.prisma.prestacionSubtipo.delete({ where: { id: toBig(id) } });
  }

  // ===== Prácticas =====
  listarPracticas(
    organizacionId: string,
    filtros?: { tipoId?: string; subtipoId?: string; q?: string },
  ) {
    const q = (filtros?.q ?? '').trim();
    const where: Prisma.PrestacionPracticaWhereInput = {
      organizacionId,
      ...(filtros?.tipoId ? { tipoId: toBig(filtros.tipoId) } : {}),
      ...(filtros?.subtipoId ? { subtipoId: toBig(filtros.subtipoId) } : {}),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { codigo: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    return this.prisma.prestacionPractica.findMany({
      where,
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    });
  }

  async crearPractica(organizacionId: string, dto: CrearPrestacionPracticaDto) {
    const tipoId = toBig(dto.tipoId);
    const tipo = await this.prisma.prestacionTipo.findFirst({
      where: { id: tipoId, organizacionId },
      select: { id: true },
    });
    if (!tipo) throw new NotFoundException('Tipo de prestación inexistente');

    let subtipoId: bigint | null = null;
    if (dto.subtipoId != null) {
      subtipoId = toBig(dto.subtipoId);
      const subtipo = await this.prisma.prestacionSubtipo.findFirst({
        where: { id: subtipoId, organizacionId, tipoId },
        select: { id: true },
      });
      if (!subtipo) throw new NotFoundException('Subtipo de prestación inexistente');
    }

    return this.prisma.prestacionPractica.create({
      data: {
        organizacionId,
        tipoId,
        subtipoId,
        codigo: dto.codigo ?? null,
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        activo: dto.activo ?? true,
        orden: dto.orden ?? null,
      },
    });
  }

  async editarPractica(organizacionId: string, id: string, dto: EditarPrestacionPracticaDto) {
    const pid = toBig(id);

    let tipoId: bigint | undefined;
    if (dto.tipoId != null) {
      tipoId = toBig(dto.tipoId);
      const tipo = await this.prisma.prestacionTipo.findFirst({
        where: { id: tipoId, organizacionId },
        select: { id: true },
      });
      if (!tipo) throw new NotFoundException('Tipo de prestación inexistente');
    }

    let subtipoId: bigint | null | undefined;
    if (dto.subtipoId !== undefined) {
      if (dto.subtipoId === null) {
        subtipoId = null;
      } else {
        const sid = toBig(dto.subtipoId);
        const st = await this.prisma.prestacionSubtipo.findFirst({
          where: { id: sid, organizacionId, ...(tipoId ? { tipoId } : {}) },
          select: { id: true },
        });
        if (!st) throw new NotFoundException('Subtipo de prestación inexistente');
        subtipoId = sid;
      }
    }

    return this.prisma.prestacionPractica.update({
      where: { id: pid },
      data: {
        ...(tipoId ? { tipoId } : {}),
        ...(subtipoId !== undefined ? { subtipoId } : {}),
        codigo: dto.codigo === undefined ? undefined : dto.codigo,
        nombre: dto.nombre ?? undefined,
        descripcion: dto.descripcion === undefined ? undefined : dto.descripcion,
        activo: dto.activo ?? undefined,
        orden: dto.orden === undefined ? undefined : dto.orden,
      },
    });
  }

  eliminarPractica(organizacionId: string, id: string) {
    return this.prisma.prestacionPractica.delete({ where: { id: toBig(id) } });
  }

  // ===== Reglas =====
  listarReglas(
    organizacionId: string,
    filtros?: { tipoId?: string; subtipoId?: string; practicaId?: string },
  ) {
    return this.prisma.prestacionRegla.findMany({
      where: {
        organizacionId,
        ...(filtros?.tipoId ? { tipoId: toBig(filtros.tipoId) } : {}),
        ...(filtros?.subtipoId ? { subtipoId: toBig(filtros.subtipoId) } : {}),
        ...(filtros?.practicaId ? { practicaId: toBig(filtros.practicaId) } : {}),
      },
      orderBy: [{ vigenteDesde: 'desc' }, { id: 'desc' }],
    });
  }

  async crearRegla(organizacionId: string, dto: CrearPrestacionReglaDto) {
    if (!dto.tipoId && !dto.subtipoId && !dto.practicaId) {
      throw new BadRequestException('Debe indicar tipo, subtipo o práctica');
    }

    const tipoId = dto.tipoId != null ? toBig(dto.tipoId) : null;
    const subtipoId = dto.subtipoId != null ? toBig(dto.subtipoId) : null;
    const practicaId = dto.practicaId != null ? toBig(dto.practicaId) : null;

    if (tipoId) {
      const tipo = await this.prisma.prestacionTipo.findFirst({
        where: { id: tipoId, organizacionId },
        select: { id: true },
      });
      if (!tipo) throw new NotFoundException('Tipo de prestación inexistente');
    }
    if (subtipoId) {
      const subtipo = await this.prisma.prestacionSubtipo.findFirst({
        where: { id: subtipoId, organizacionId },
        select: { id: true },
      });
      if (!subtipo) throw new NotFoundException('Subtipo de prestación inexistente');
    }
    if (practicaId) {
      const practica = await this.prisma.prestacionPractica.findFirst({
        where: { id: practicaId, organizacionId },
        select: { id: true },
      });
      if (!practica) throw new NotFoundException('Práctica inexistente');
    }

    const vigenteDesde = parseDate(dto.vigenteDesde);
    if (!vigenteDesde) throw new BadRequestException('vigenteDesde requerido');

    return this.prisma.prestacionRegla.create({
      data: {
        organizacionId,
        tipoId,
        subtipoId,
        practicaId,
        porcentaje: dto.porcentaje != null ? new Prisma.Decimal(dto.porcentaje) : null,
        tope: dto.tope != null ? new Prisma.Decimal(dto.tope) : null,
        vigenteDesde,
        vigenteHasta: parseDate(dto.vigenteHasta),
        activo: dto.activo ?? true,
      },
    });
  }

  async editarRegla(organizacionId: string, id: string, dto: EditarPrestacionReglaDto) {
    const rid = toBig(id);

    const tipoId = dto.tipoId != null ? toBig(dto.tipoId) : undefined;
    const subtipoId = dto.subtipoId != null ? toBig(dto.subtipoId) : undefined;
    const practicaId = dto.practicaId != null ? toBig(dto.practicaId) : undefined;

    if (tipoId) {
      const tipo = await this.prisma.prestacionTipo.findFirst({
        where: { id: tipoId, organizacionId },
        select: { id: true },
      });
      if (!tipo) throw new NotFoundException('Tipo de prestación inexistente');
    }
    if (subtipoId) {
      const subtipo = await this.prisma.prestacionSubtipo.findFirst({
        where: { id: subtipoId, organizacionId },
        select: { id: true },
      });
      if (!subtipo) throw new NotFoundException('Subtipo de prestación inexistente');
    }
    if (practicaId) {
      const practica = await this.prisma.prestacionPractica.findFirst({
        where: { id: practicaId, organizacionId },
        select: { id: true },
      });
      if (!practica) throw new NotFoundException('Práctica inexistente');
    }

    return this.prisma.prestacionRegla.update({
      where: { id: rid },
      data: {
        ...(tipoId !== undefined ? { tipoId } : {}),
        ...(subtipoId !== undefined ? { subtipoId } : {}),
        ...(practicaId !== undefined ? { practicaId } : {}),
        porcentaje: dto.porcentaje === undefined ? undefined : dto.porcentaje != null ? new Prisma.Decimal(dto.porcentaje) : null,
        tope: dto.tope === undefined ? undefined : dto.tope != null ? new Prisma.Decimal(dto.tope) : null,
        vigenteDesde: dto.vigenteDesde ? parseDate(dto.vigenteDesde) ?? undefined : undefined,
        vigenteHasta: dto.vigenteHasta === undefined ? undefined : parseDate(dto.vigenteHasta) ?? undefined,
        activo: dto.activo ?? undefined,
      },
    });
  }

  eliminarRegla(organizacionId: string, id: string) {
    return this.prisma.prestacionRegla.delete({ where: { id: toBig(id) } });
  }
}
