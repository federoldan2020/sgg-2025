// src/modulos/colaterales/colaterales-reglas.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateReglaColateralDto, UpdateReglaColateralDto } from './dtos';
import { ColateralesCalculoService } from './colaterales-calculo.service';
import { NovedadesService } from '../novedades/novedades.service';

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
    private readonly novedades: NovedadesService,
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
    const created = await this.prisma.reglaPrecioColateral.create({
      data: {
        organizacionId,
        parentescoId: toBig(dto.parentescoId),
        cantidadDesde: Number(dto.cantidadDesde),
        cantidadHasta: dto.cantidadHasta == null ? null : Number(dto.cantidadHasta),
        vigenteDesde: desde,
        vigenteHasta: hasta,
        precioTotal: Number(dto.precioTotal),
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
        ...(dto.parentescoId != null ? { parentescoId: toBig(dto.parentescoId) } : {}),
        ...(dto.cantidadDesde != null ? { cantidadDesde: Number(dto.cantidadDesde) } : {}),
        ...(dto.cantidadHasta !== undefined
          ? { cantidadHasta: dto.cantidadHasta == null ? null : Number(dto.cantidadHasta) }
          : {}),
        ...(dto.precioTotal != null ? { precioTotal: Number(dto.precioTotal) } : {}),
        ...(dto.vigenteDesde != null ? { vigenteDesde: fechas.desde } : {}),
        ...(dto.vigenteHasta !== undefined ? { vigenteHasta: fechas.hasta ?? null } : {}),
        ...(dto.activo != null ? { activo: !!dto.activo } : {}),
      },
      select: { parentescoId: true },
    });

    // Recalcular por el parentesco final de la regla
    const parId = dto.parentescoId != null ? toBig(dto.parentescoId) : updated.parentescoId;
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
   * Afiliados con coseguro ACTIVO y colaterales activos del parentesco dado.
   * Para cada uno: recalcular total J38 y registrar **MODIF** con nuevoTotal (incluye 0).
   */
  private async recalcularAfectadosYNotificar(organizacionId: string, parentescoId: bigint) {
    const ahora = new Date();

    const afiliados = await this.prisma.colateral.findMany({
      where: {
        parentescoId,
        activo: true,
        afiliado: { organizacionId, coseguro: { estado: 'activo' } },
      },
      select: { afiliadoId: true },
      distinct: ['afiliadoId'],
    });

    for (const row of afiliados) {
      const total = await this.calc.calcularTotalJ38(organizacionId, row.afiliadoId, ahora);
      const padronId = (await this.calc.getPadronDestino(organizacionId, row.afiliadoId)) ?? 0n;

      // Requisito: “si es baja total, enviamos 0” → MODIF con nuevoTotal=0
      await this.novedades.registrarModifColaterales({
        organizacionId,
        afiliadoId: row.afiliadoId,
        padronId,
        ocurridoEn: ahora,
        observacion: 'Recalculo por cambio de regla J38',
        nuevoTotal: total, // puede ser 0
      });
    }

    return { total: afiliados.length };
  }
}
