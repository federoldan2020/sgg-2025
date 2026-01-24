import { Controller, Post, Get, Body, Query, Req } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
const prisma = new PrismaClient();

@Controller('obligaciones')
@Public() // Temporalmente público para testing
export class ObligacionesController {
  @Post()
  async crear(
    @Req() req,
    @Body()
    dto: {
      afiliadoId: number;
      padronId?: number;
      conceptoCodigo: string;
      periodo: string;
      monto: number;
      origen?: string;
    },
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    const concepto = await prisma.concepto.findFirst({
      where: { organizacionId: org, codigo: dto.conceptoCodigo },
    });
    if (!concepto) throw new Error('Concepto no encontrado');
    return prisma.obligacion.create({
      data: {
        organizacionId: org,
        afiliadoId: BigInt(dto.afiliadoId),
        padronId: dto.padronId ? BigInt(dto.padronId) : null,
        conceptoId: concepto.id,
        periodo: dto.periodo,
        origen: dto.origen ?? 'liquidacion',
        monto: dto.monto,
        saldo: dto.monto,
      },
    });
  }

  @Get('por-afiliado')
  async porAfiliado(@Req() req, @Query('afiliadoId') afiliadoId: string) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return prisma.obligacion.findMany({
      where: { organizacionId: org, afiliadoId: BigInt(afiliadoId) },
      include: { concepto: true, padron: true },
    });
  }

  @Get('pendientes')
  async pendientes(
    @Req() req,
    @Query('afiliadoId') afiliadoId: string,
    @Query('padronId') padronId?: string,
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    if (!afiliadoId) throw new Error('afiliadoId requerido');

    const afiliadoIdBig = BigInt(afiliadoId);

    // ===== 1) Obligaciones pendientes =====
    const whereObl: any = {
      organizacionId: org,
      afiliadoId: afiliadoIdBig,
      saldo: { gt: 0 }, // Solo pendientes (saldo > 0)
    };

    if (padronId) {
      whereObl.padronId = BigInt(padronId);
    }

    const obligaciones = await prisma.obligacion.findMany({
      where: whereObl,
      include: {
        concepto: { select: { codigo: true, nombre: true } },
        padron: { select: { id: true, padron: true, sistema: true, centro: true } },
      },
      orderBy: [{ periodo: 'desc' }, { id: 'asc' }],
    });

    // ===== 2) Cuotas de órdenes de crédito pendientes =====
    const whereOrden: any = {
      organizacionId: org,
      afiliadoId: afiliadoIdBig,
      estado: { in: ['pendiente', 'en_curso'] },
      cuotas: {
        some: {
          saldo: { gt: 0 },
          estado: { in: ['pendiente', 'generada', 'parcialmente_pagada'] },
        },
      },
    };

    if (padronId) {
      whereOrden.padronId = BigInt(padronId);
    }

    const ordenes = await prisma.ordenCredito.findMany({
      where: whereOrden,
      include: {
        padron: { select: { id: true, padron: true, sistema: true, centro: true } },
        cuotas: {
          where: {
            saldo: { gt: 0 },
            estado: { in: ['pendiente', 'generada', 'parcialmente_pagada'] },
          },
          orderBy: [{ numero: 'asc' }],
        },
      },
      orderBy: [{ fechaAlta: 'desc' }],
    });

    // ===== 3) Formatear respuesta combinada =====
    const resultado: any[] = [];

    // Obligaciones
    for (const o of obligaciones) {
      resultado.push({
        id: `OBL-${o.id.toString()}`,
        obligacionId: o.id.toString(),
        tipo: 'obligacion',
        padronLabel: o.padron
          ? `${o.padron.padron}${o.padron.centro ? ` (Centro: ${o.padron.centro})` : ''}`
          : 'Sin padrón',
        concepto: o.concepto?.nombre || o.concepto?.codigo || 'Sin concepto',
        saldo: Number(o.saldo),
        periodo: o.periodo,
        monto: Number(o.monto),
      });
    }

    // Cuotas de órdenes de crédito
    for (const orden of ordenes) {
      for (const cuota of orden.cuotas) {
        const concepto = `ORD#${orden.id.toString()} - Cuota ${cuota.numero}${orden.cantidadCuotas ? `/${orden.cantidadCuotas}` : ''} (${cuota.periodoVenc})`;
        resultado.push({
          id: `CUO-${cuota.id.toString()}`,
          cuotaId: cuota.id.toString(),
          ordenId: orden.id.toString(),
          tipo: 'cuota',
          padronLabel: orden.padron
            ? `${orden.padron.padron}${orden.padron.centro ? ` (Centro: ${orden.padron.centro})` : ''}`
            : 'Sin padrón',
          concepto: orden.descripcion || concepto,
          saldo: Number(cuota.saldo),
          periodo: cuota.periodoVenc,
          monto: Number(cuota.importe),
        });
      }
    }

    // Ordenar por período descendente y luego por ID
    resultado.sort((a, b) => {
      if (a.periodo !== b.periodo) {
        return (b.periodo || '').localeCompare(a.periodo || '');
      }
      return a.id.localeCompare(b.id);
    });

    return resultado;
  }
}
