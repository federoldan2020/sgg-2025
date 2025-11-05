import { Controller, Post, Get, Body, Query, Req } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

@Controller('obligaciones')
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
}
