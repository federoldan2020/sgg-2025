// src/modulos/nomina/nomina.service.ts
import { Injectable } from '@nestjs/common';
// Recomendado: usar un singleton compartido
// import { prisma } from '../../prisma';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

type PreviewDto = {
  periodo: string;
  archivoNombre?: string;
  hash?: string;
  items: Array<{
    afiliadoId?: number;
    dni?: number;
    padronId?: number;
    codigo: string;
    monto: number;
  }>;
};

@Injectable()
export class NominaService {
  async preview(orgId: string, dto: PreviewDto) {
    if (dto.hash) {
      const yaExiste = await prisma.loteNomina.findFirst({
        where: { organizacionId: orgId, periodo: dto.periodo, hashContenido: dto.hash },
        select: { id: true, estado: true },
      });
      if (yaExiste) {
        return {
          mensaje: 'Lote ya cargado',
          loteId: yaExiste.id.toString(),
          estado: yaExiste.estado,
        };
      }
    }

    // 🔧 TIPADO EXPLÍCITO PARA EVITAR never[]
    const detallesToCreate: Array<{
      afiliadoId: bigint;
      padronId: bigint | null;
      codigo: string;
      monto: number;
    }> = [];

    for (const it of dto.items) {
      let afiliadoIdBig: bigint | null = null;

      if (typeof it.afiliadoId === 'number' && !Number.isNaN(it.afiliadoId)) {
        afiliadoIdBig = BigInt(it.afiliadoId);
      } else if (typeof it.dni === 'number' && !Number.isNaN(it.dni)) {
        const af = await prisma.afiliado.findFirst({
          where: { organizacionId: orgId, dni: BigInt(it.dni) },
          select: { id: true },
        });
        if (af) afiliadoIdBig = af.id;
      }

      if (!afiliadoIdBig) continue;

      detallesToCreate.push({
        afiliadoId: afiliadoIdBig,
        padronId: typeof it.padronId === 'number' ? BigInt(it.padronId) : null,
        codigo: it.codigo,
        monto: it.monto, // Prisma acepta number para Decimal
      });
    }

    const lote = await prisma.loteNomina.create({
      data: {
        organizacionId: orgId,
        periodo: dto.periodo,
        archivoNombre: dto.archivoNombre,
        hashContenido: dto.hash,
        estado: 'previsualizado',
        detalles: { create: detallesToCreate },
      },
      include: { detalles: true },
    });

    const total = lote.detalles.reduce((a, d) => a + Number(d.monto), 0);
    const porAfiliado = Object.values(
      lote.detalles.reduce((acc: Record<string, { afiliadoId: string; total: number }>, d) => {
        const k = d.afiliadoId.toString();
        acc[k] ??= { afiliadoId: k, total: 0 };
        acc[k].total += Number(d.monto);
        return acc;
      }, {}),
    );

    return {
      mensaje: 'Preview generado',
      loteId: lote.id.toString(),
      periodo: dto.periodo,
      total,
      resumen: porAfiliado,
    };
  }

  async confirmar(orgId: string, loteIdNum: number) {
    const loteId = BigInt(loteIdNum);
    const lote = await prisma.loteNomina.findFirstOrThrow({
      where: { id: loteId, organizacionId: orgId },
      include: { detalles: true },
    });

    if (lote.estado === 'confirmado') {
      return { ok: true, mensaje: 'Lote ya confirmado', loteId: lote.id.toString() };
    }

    await prisma.$transaction(async (tx) => {
      await tx.loteNomina.update({
        where: { id: lote.id },
        data: { estado: 'confirmado' },
      });
    });

    return { ok: true, mensaje: 'Conciliación aplicada (MVP)', loteId: lote.id.toString() };
  }
}
