// src/modulos/colaterales/colaterales-reglas.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateReglaColateralDto, UpdateReglaColateralDto } from './dtos';
import { ColateralesCalculoService } from './colaterales-calculo.service';

type ListParams = { activo?: boolean; parentescoId?: bigint | number | string };
const toBig = (v: bigint | number | string): bigint => {
  try {
    return typeof v === 'bigint' ? v : BigInt(v);
  } catch {
    throw new BadRequestException('Identificador inválido');
  }
};

@Injectable()
export class ColateralesReglasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calc: ColateralesCalculoService,
  ) {}

  private ensureDates(input: { vigenteDesde: string; vigenteHasta?: string | null }) {
    const desde = new Date(input.vigenteDesde);
    if (isNaN(desde.getTime())) throw new BadRequestException('vigenteDesde inválida');
    const hasta =
      input.vigenteHasta === '' || input.vigenteHasta == null ? null : new Date(input.vigenteHasta);
    if (hasta && isNaN(hasta.getTime())) throw new BadRequestException('vigenteHasta inválida');
    if (hasta && hasta < desde) throw new BadRequestException('vigenteHasta < vigenteDesde');
    return { desde, hasta };
  }

  async list(organizacionId: string, params: ListParams = {}) {
    const where: any = { organizacionId };
    if (params.activo != null) where.activo = params.activo;
    if (params.parentescoId != null) where.parentescoId = toBig(params.parentescoId);

    return this.prisma.reglaPrecioColateral.findMany({
      where,
      include: { parentesco: { select: { id: true, codigo: true, descripcion: true } } },
      orderBy: [
        { parentescoId: 'asc' },
        { cantidadDesde: 'asc' },
        { vigenteDesde: 'desc' },
        { id: 'asc' },
      ],
    });
  }

  async create(organizacionId: string, dto: CreateReglaColateralDto) {
    const { desde, hasta } = this.ensureDates(dto);

    // Exactamente uno de precioPorColateral / precioTotal.
    const tienePorCol = dto.precioPorColateral != null;
    const tieneTotal = dto.precioTotal != null;
    if (tienePorCol === tieneTotal) {
      throw new BadRequestException(
        'Debe enviar exactamente uno de precioPorColateral o precioTotal',
      );
    }

    const created = await this.prisma.reglaPrecioColateral.create({
      data: {
        organizacionId,
        // parentescoId puede ser null (comodín)
        parentescoId: dto.parentescoId == null ? null : toBig(dto.parentescoId),
        cantidadDesde: Number(dto.cantidadDesde),
        cantidadHasta: dto.cantidadHasta == null ? null : Number(dto.cantidadHasta),
        vigenteDesde: desde,
        vigenteHasta: hasta,
        precioPorColateral:
          dto.precioPorColateral != null ? Number(dto.precioPorColateral) : null,
        precioTotal: dto.precioTotal != null ? Number(dto.precioTotal) : null,
        activo: dto.activo ?? true,
      },
      select: { id: true, parentescoId: true },
    });

    await this.recalcularAfectadosYNotificar(organizacionId, created.parentescoId);
    return { id: created.id.toString() };
  }

  async get(organizacionId: string, id: string) {
    const row = await this.prisma.reglaPrecioColateral.findFirst({
      where: { organizacionId, id: toBig(id) },
      include: { parentesco: { select: { id: true, codigo: true, descripcion: true } } },
    });
    if (!row) throw new NotFoundException('Regla no encontrada');
    return row;
  }

  async update(organizacionId: string, id: string, dto: UpdateReglaColateralDto) {
    const current = await this.get(organizacionId, id);

    let fechas: { desde?: Date; hasta?: Date | null } = {};
    if (dto.vigenteDesde || dto.vigenteHasta !== undefined) {
      const baseDesde = dto.vigenteDesde ?? current.vigenteDesde.toISOString().slice(0, 10);
      const baseHasta =
        dto.vigenteHasta ?? current.vigenteHasta?.toISOString().slice(0, 10) ?? null;
      const { desde, hasta } = this.ensureDates({
        vigenteDesde: baseDesde,
        vigenteHasta: baseHasta ?? undefined,
      });
      fechas = { desde, hasta };
    }

    const updated = await this.prisma.reglaPrecioColateral.update({
      where: { id: toBig(id) },
      data: {
        // parentescoId: null explícito = pasar a comodín; undefined = no tocar.
        ...(dto.parentescoId !== undefined
          ? { parentescoId: dto.parentescoId === null ? null : toBig(dto.parentescoId) }
          : {}),
        ...(dto.cantidadDesde != null ? { cantidadDesde: Number(dto.cantidadDesde) } : {}),
        ...(dto.cantidadHasta !== undefined
          ? { cantidadHasta: dto.cantidadHasta == null ? null : Number(dto.cantidadHasta) }
          : {}),
        ...(dto.precioPorColateral !== undefined
          ? {
              precioPorColateral:
                dto.precioPorColateral === null ? null : Number(dto.precioPorColateral),
            }
          : {}),
        ...(dto.precioTotal !== undefined
          ? { precioTotal: dto.precioTotal === null ? null : Number(dto.precioTotal) }
          : {}),
        ...(dto.vigenteDesde != null ? { vigenteDesde: fechas.desde } : {}),
        ...(dto.vigenteHasta !== undefined ? { vigenteHasta: fechas.hasta ?? null } : {}),
        ...(dto.activo != null ? { activo: !!dto.activo } : {}),
      },
      select: { parentescoId: true },
    });

    // Recalcular por el parentesco final de la regla.
    // Si el dto cambió el parentescoId, prevalece ese (incluido null=comodín).
    const parId =
      dto.parentescoId !== undefined
        ? dto.parentescoId === null
          ? null
          : toBig(dto.parentescoId)
        : updated.parentescoId;
    await this.recalcularAfectadosYNotificar(organizacionId, parId);
    return { ok: true as const };
  }

  async toggle(organizacionId: string, id: string, activo: boolean) {
    const upd = await this.prisma.reglaPrecioColateral.update({
      where: { id: toBig(id) },
      data: { activo: !!activo },
      select: { parentescoId: true },
    });
    await this.recalcularAfectadosYNotificar(organizacionId, upd.parentescoId);
    return { id: toBig(id), activo: !!activo };
  }

  async remove(organizacionId: string, id: string) {
    const curr = await this.get(organizacionId, id);
    await this.prisma.reglaPrecioColateral.delete({ where: { id: toBig(id) } });
    await this.recalcularAfectadosYNotificar(organizacionId, curr.parentescoId);
    return { ok: true as const };
  }

  /**
   * Afiliados con coseguro ACTIVO afectados por el cambio de regla.
   * Si `parentescoId === null` → regla comodín → afecta a todos los afiliados
   * con coseguro activo. Si es un bigint → solo los que tienen colaterales
   * activos de ese parentesco.
   *
   * Para cada uno: recalcular total J38. El módulo nuevo de novedades detectará
   * el delta J38 al generar el lote.
   */
  private async recalcularAfectadosYNotificar(
    organizacionId: string,
    parentescoId: bigint | null,
  ) {
    const ahora = new Date();

    const afiliados =
      parentescoId === null
        ? await this.prisma.coseguroAfiliado.findMany({
            where: { organizacionId, estado: 'activo' },
            select: { afiliadoId: true },
            distinct: ['afiliadoId'],
          })
        : await this.prisma.colateral.findMany({
            where: {
              parentescoId,
              activo: true,
              afiliado: { organizacionId, coseguro: { estado: 'activo' } },
            },
            select: { afiliadoId: true },
            distinct: ['afiliadoId'],
          });

    for (const row of afiliados) {
      await this.calc.calcularTotalJ38(organizacionId, row.afiliadoId, ahora);
    }

    return { total: afiliados.length };
  }
}
