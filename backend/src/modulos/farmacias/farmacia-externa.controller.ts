import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { FarmaciaAuthService } from './farmacia-auth.service';
import { CurrentFarmacia } from './decorators/current-farmacia.decorator';
import type { CurrentFarmaciaPayload } from './decorators/current-farmacia.decorator';
import { FarmaciaJwtGuard } from './guards/farmacia-jwt.guard';
import { LoginFarmaciaDto, RegistrarConsumoDto, AnularConsumoDto } from './dtos';
import { OrdenesFarmaciaService } from './ordenes-farmacia.service';

/**
 * API pública de la vista de farmacias externas.
 *
 * - POST /farmacia-externa/auth/login         → @Public, devuelve JWT
 * - Resto: @Public + FarmaciaJwtGuard (auth con token propio).
 *
 * Notas:
 *   - El token de farmacia trae `organizacionId` y la org se infiere de ahí
 *     (NO se acepta `X-Organizacion-ID` desde la farmacia — debe usar el
 *     token).
 *   - El alcance está acotado por el guard: la farmacia solo ve datos de su org.
 */
@Controller('farmacia-externa')
export class FarmaciaExternaController {
  constructor(
    private readonly auth: FarmaciaAuthService,
    private readonly ordenes: OrdenesFarmaciaService,
    private readonly prisma: PrismaService,
  ) {}

  // -------------- AUTH --------------
  @Public()
  @Post('auth/login')
  login(@Body() dto: LoginFarmaciaDto) {
    return this.auth.login(dto);
  }

  @Public()
  @UseGuards(FarmaciaJwtGuard)
  @Get('auth/me')
  me(@CurrentFarmacia() farmacia: CurrentFarmaciaPayload) {
    return {
      id: farmacia.id.toString(),
      codigo: farmacia.codigo,
      nombre: farmacia.nombre,
      organizacionId: farmacia.organizacionId,
    };
  }

  // -------------- BÚSQUEDA AFILIADO --------------
  /**
   * Busca afiliado por DNI dentro de la org de la farmacia.
   * Devuelve titular + integrantes activos del grupo + cupo del mes.
   */
  @Public()
  @UseGuards(FarmaciaJwtGuard)
  @Get('afiliado')
  async buscarAfiliado(
    @CurrentFarmacia() farmacia: CurrentFarmaciaPayload,
    @Query('dni') dni: string,
  ) {
    if (!dni || !/^\d{6,12}$/.test(dni.trim())) {
      throw new BadRequestException('DNI inválido');
    }
    const af = await this.prisma.afiliado.findFirst({
      where: { organizacionId: farmacia.organizacionId, dni: BigInt(dni.trim()) },
      select: {
        id: true,
        dni: true,
        apellido: true,
        nombre: true,
        estado: true,
        coseguro: { select: { estado: true } },
      },
    });
    if (!af) throw new NotFoundException('Afiliado no encontrado');

    const integrantes = await this.prisma.colateral.findMany({
      where: { afiliadoId: af.id, activo: true },
      select: {
        id: true,
        nombre: true,
        dni: true,
        fechaNacimiento: true,
        parentesco: { select: { codigo: true, descripcion: true } },
      },
      orderBy: { id: 'asc' },
    });

    const saldo = await this.ordenes.getSaldo(farmacia.organizacionId, af.id);

    return {
      titular: {
        id: af.id.toString(),
        dni: af.dni.toString(),
        apellido: af.apellido,
        nombre: af.nombre,
        estado: af.estado,
        coseguroActivo: af.coseguro?.estado === 'activo',
      },
      grupo: integrantes.map((i) => ({
        id: i.id.toString(),
        nombre: i.nombre,
        dni: i.dni,
        fechaNacimiento: i.fechaNacimiento?.toISOString().slice(0, 10) ?? null,
        parentesco: i.parentesco
          ? { codigo: i.parentesco.codigo, descripcion: i.parentesco.descripcion }
          : null,
      })),
      saldoOrdenes: saldo,
    };
  }

  // -------------- CONSUMIR --------------
  @Public()
  @UseGuards(FarmaciaJwtGuard)
  @Post('consumir')
  async consumir(
    @CurrentFarmacia() farmacia: CurrentFarmaciaPayload,
    @Body() dto: RegistrarConsumoDto,
  ) {
    // Resolver afiliado por DNI
    if (!dto.dni || !/^\d{6,12}$/.test(dto.dni.trim())) {
      throw new BadRequestException('DNI inválido');
    }
    const af = await this.prisma.afiliado.findFirst({
      where: { organizacionId: farmacia.organizacionId, dni: BigInt(dto.dni.trim()) },
      select: { id: true },
    });
    if (!af) throw new NotFoundException('Afiliado no encontrado');

    return this.ordenes.consumir({
      organizacionId: farmacia.organizacionId,
      afiliadoTitularId: af.id,
      integranteColateralId: dto.integranteId ?? null,
      farmaciaId: farmacia.id,
      monto: dto.monto ?? null,
      observacion: dto.observacion ?? null,
    });
  }

  // -------------- MIS CONSUMOS --------------
  @Public()
  @UseGuards(FarmaciaJwtGuard)
  @Get('mis-consumos')
  async misConsumos(
    @CurrentFarmacia() farmacia: CurrentFarmaciaPayload,
    @Query('periodo') periodo?: string,
  ) {
    const per = (periodo ?? this.ordenes.periodoDe()).slice(0, 6);
    const rows = await this.prisma.ordenFarmaciaConsumo.findMany({
      where: {
        organizacionId: farmacia.organizacionId,
        farmaciaId: farmacia.id,
        periodo: per,
      },
      orderBy: { consumidaEn: 'desc' },
      include: {
        afiliado: { select: { id: true, dni: true, apellido: true, nombre: true } },
        integrante: { select: { id: true, nombre: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id.toString(),
      consumidaEn: r.consumidaEn.toISOString(),
      monto: r.monto != null ? Number(r.monto) : null,
      observacion: r.observacion,
      anuladaEn: r.anuladaEn?.toISOString() ?? null,
      afiliado: {
        id: r.afiliado.id.toString(),
        dni: r.afiliado.dni.toString(),
        apellido: r.afiliado.apellido,
        nombre: r.afiliado.nombre,
      },
      integrante: r.integrante
        ? { id: r.integrante.id.toString(), nombre: r.integrante.nombre }
        : null,
    }));
  }

  // -------------- ANULAR PROPIO --------------
  @Public()
  @UseGuards(FarmaciaJwtGuard)
  @Post('mis-consumos/:consumoId/anular')
  async anularPropio(
    @CurrentFarmacia() farmacia: CurrentFarmaciaPayload,
    @Param('consumoId') consumoId: string,
    @Body() dto: AnularConsumoDto,
  ) {
    // Verificar que el consumo sea de esta farmacia
    const c = await this.prisma.ordenFarmaciaConsumo.findFirst({
      where: { id: BigInt(consumoId), farmaciaId: farmacia.id },
      select: { id: true },
    });
    if (!c) throw new NotFoundException('Consumo no encontrado para esta farmacia');

    return this.ordenes.anular({
      organizacionId: farmacia.organizacionId,
      consumoId,
      motivo: dto.motivo,
      actorLabel: `farmacia:${farmacia.id.toString()}`,
    });
  }
}
