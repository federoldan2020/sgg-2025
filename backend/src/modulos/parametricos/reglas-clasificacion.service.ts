import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type {
  CrearReglaClasificacionDto,
  EditarReglaClasificacionDto,
  ReordenarReglasClasificacionDto,
} from './dtos';
import type { Prisma, Sexo, ClasifResultado } from '@prisma/client';

@Injectable()
export class ReglasClasificacionService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.reglaClasificacionIntegrante.findMany({
      where: { organizacionId: orgId },
      orderBy: [{ activo: 'desc' }, { prioridad: 'asc' }],
      include: {
        parentesco: { select: { id: true, codigo: true, descripcion: true } },
      },
    });
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.reglaClasificacionIntegrante.findFirst({
      where: { id: BigInt(id), organizacionId: orgId },
      include: { parentesco: { select: { id: true, codigo: true, descripcion: true } } },
    });
    if (!row) throw new NotFoundException('Regla de clasificación no encontrada');
    return row;
  }

  async create(orgId: string, dto: CrearReglaClasificacionDto) {
    if (!Number.isInteger(dto.prioridad)) {
      throw new BadRequestException('prioridad debe ser entero');
    }
    const desde = new Date(dto.vigenteDesde);
    if (Number.isNaN(desde.getTime())) throw new BadRequestException('vigenteDesde inválida');
    const hasta = dto.vigenteHasta ? new Date(dto.vigenteHasta) : null;
    if (hasta && Number.isNaN(hasta.getTime())) {
      throw new BadRequestException('vigenteHasta inválida');
    }

    const parentescoId = await this.resolveParentesco(orgId, dto.parentescoCodigo);

    return this.prisma.reglaClasificacionIntegrante.create({
      data: {
        organizacionId: orgId,
        parentescoId,
        sexoTitular: dto.sexoTitular ? (dto.sexoTitular as Sexo) : null,
        edadDesde: dto.edadDesde ?? null,
        edadHasta: dto.edadHasta ?? null,
        requiereEstudiante: dto.requiereEstudiante ?? null,
        requiereAportes: dto.requiereAportes ?? null,
        requiereDiscapacidad: dto.requiereDiscapacidad ?? null,
        resultado: dto.resultado as ClasifResultado,
        prioridad: dto.prioridad,
        vigenteDesde: desde,
        vigenteHasta: hasta,
        activo: dto.activo ?? true,
        descripcion: dto.descripcion ?? null,
      },
    });
  }

  async update(orgId: string, id: string, dto: EditarReglaClasificacionDto) {
    const rid = BigInt(id);
    await this.assertExiste(orgId, rid);

    let hasta: Date | null | undefined = undefined;
    if (dto.vigenteHasta !== undefined) {
      hasta = dto.vigenteHasta ? new Date(dto.vigenteHasta) : null;
      if (hasta && Number.isNaN(hasta.getTime())) {
        throw new BadRequestException('vigenteHasta inválida');
      }
    }
    let parentescoIdUpdate: bigint | null | undefined = undefined;
    if (dto.parentescoCodigo !== undefined) {
      parentescoIdUpdate = await this.resolveParentesco(orgId, dto.parentescoCodigo);
    }

    const data: Prisma.ReglaClasificacionIntegranteUpdateInput = {};
    if (parentescoIdUpdate !== undefined) {
      data.parentesco =
        parentescoIdUpdate === null
          ? { disconnect: true }
          : { connect: { id: parentescoIdUpdate } };
    }
    if (dto.sexoTitular !== undefined)
      data.sexoTitular = (dto.sexoTitular as Sexo) ?? null;
    if (dto.edadDesde !== undefined) data.edadDesde = dto.edadDesde;
    if (dto.edadHasta !== undefined) data.edadHasta = dto.edadHasta;
    if (dto.requiereEstudiante !== undefined) data.requiereEstudiante = dto.requiereEstudiante;
    if (dto.requiereAportes !== undefined) data.requiereAportes = dto.requiereAportes;
    if (dto.requiereDiscapacidad !== undefined)
      data.requiereDiscapacidad = dto.requiereDiscapacidad;
    if (dto.resultado !== undefined) data.resultado = dto.resultado as ClasifResultado;
    if (dto.prioridad !== undefined) data.prioridad = dto.prioridad;
    if (hasta !== undefined) data.vigenteHasta = hasta;
    if (dto.activo !== undefined) data.activo = dto.activo;
    if (dto.descripcion !== undefined) data.descripcion = dto.descripcion;

    return this.prisma.reglaClasificacionIntegrante.update({ where: { id: rid }, data });
  }

  async remove(orgId: string, id: string) {
    const rid = BigInt(id);
    await this.assertExiste(orgId, rid);
    await this.prisma.reglaClasificacionIntegrante.delete({ where: { id: rid } });
    return { ok: true as const };
  }

  async toggle(orgId: string, id: string, activo: boolean) {
    const rid = BigInt(id);
    await this.assertExiste(orgId, rid);
    return this.prisma.reglaClasificacionIntegrante.update({
      where: { id: rid },
      data: { activo: !!activo },
    });
  }

  /** Reasigna las prioridades en una sola transacción. */
  async reordenar(orgId: string, dto: ReordenarReglasClasificacionDto) {
    if (!Array.isArray(dto.orden) || dto.orden.length === 0) {
      throw new BadRequestException('orden vacío');
    }
    const ids = dto.orden.map((x) => BigInt(x.id));
    const existentes = await this.prisma.reglaClasificacionIntegrante.findMany({
      where: { id: { in: ids }, organizacionId: orgId },
      select: { id: true },
    });
    if (existentes.length !== ids.length) {
      throw new BadRequestException('Hay ids en `orden` que no pertenecen a esta organización');
    }

    await this.prisma.$transaction(
      dto.orden.map((x) =>
        this.prisma.reglaClasificacionIntegrante.update({
          where: { id: BigInt(x.id) },
          data: { prioridad: x.prioridad },
        }),
      ),
    );
    return { ok: true as const, total: dto.orden.length };
  }

  // ------------ helpers ------------
  private async assertExiste(orgId: string, id: bigint) {
    const ok = await this.prisma.reglaClasificacionIntegrante.findFirst({
      where: { id, organizacionId: orgId },
      select: { id: true },
    });
    if (!ok) throw new NotFoundException('Regla de clasificación no encontrada');
  }

  /** Resuelve `parentescoCodigo` (cód numérico de Parentesco.codigo) a su id BigInt, o null. */
  private async resolveParentesco(
    orgId: string,
    codigo: number | null | undefined,
  ): Promise<bigint | null> {
    if (codigo == null) return null;
    const p = await this.prisma.parentesco.findUnique({
      where: {
        organizacionId_codigo_parentesco: { organizacionId: orgId, codigo },
      },
      select: { id: true },
    });
    if (!p) throw new BadRequestException(`Parentesco con código ${codigo} no existe`);
    return p.id;
  }
}
