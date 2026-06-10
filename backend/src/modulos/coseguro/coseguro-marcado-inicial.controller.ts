import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Usuario } from '@prisma/client';
import { IsBoolean, IsOptional } from 'class-validator';

type ReqOrg = Request & { organizacionId?: string };

class MarcarInicialesDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

/**
 * Endpoint one-shot: detecta afiliados con descuentos J22 históricos
 * (MovimientoAfiliado.concepto LIKE 'J22%', origen='nomina') y los marca
 * con CoseguroAfiliado.estado='activo'. Idempotente: no toca a quienes ya
 * están activos.
 */
@Controller('coseguro')
export class CoseguroMarcadoInicialController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Post('marcar-iniciales-desde-movimientos')
  async marcarIniciales(
    @Req() req: ReqOrg,
    @Body() dto: MarcarInicialesDto,
    @CurrentUser() user?: Usuario,
  ) {
    const organizacionId = req.organizacionId;
    if (!organizacionId) throw new BadRequestException('Falta organización');
    const dryRun = !!dto.dryRun;

    // 1) Buscar (afiliadoId, fecha más antigua) con movimiento J22 cobrado por nómina.
    const movs = await this.prisma.movimientoAfiliado.findMany({
      where: {
        organizacionId,
        naturaleza: 'credito',
        origen: 'nomina',
        concepto: { startsWith: 'J22' },
      },
      select: { afiliadoId: true, fecha: true, padronId: true },
      orderBy: { fecha: 'asc' },
    });

    type Acc = { fechaMinima: Date; padronImputacion: bigint | null };
    const porAfiliado = new Map<string, Acc>();
    for (const m of movs) {
      const key = m.afiliadoId.toString();
      const ex = porAfiliado.get(key);
      if (!ex) {
        porAfiliado.set(key, { fechaMinima: m.fecha, padronImputacion: m.padronId });
      } else if (m.fecha < ex.fechaMinima) {
        ex.fechaMinima = m.fecha;
        ex.padronImputacion = m.padronId;
      }
    }

    if (porAfiliado.size === 0) {
      return {
        dryRun,
        afiliadosConJ22: 0,
        yaActivos: 0,
        reactivados: 0,
        nuevosActivos: 0,
      };
    }

    // 2) Obtener el CoseguroAfiliado actual de cada uno.
    const afiliadosIds = [...porAfiliado.keys()].map((k) => BigInt(k));
    const existentes = await this.prisma.coseguroAfiliado.findMany({
      where: { organizacionId, afiliadoId: { in: afiliadosIds } },
      select: {
        id: true,
        afiliadoId: true,
        estado: true,
        fechaAlta: true,
        imputacionPadronIdCoseguro: true,
      },
    });
    const mapaExistentes = new Map(existentes.map((e) => [e.afiliadoId.toString(), e]));

    let yaActivos = 0;
    let reactivados = 0;
    let nuevosActivos = 0;

    const ops: Array<() => Promise<unknown>> = [];

    for (const [afiliadoIdStr, acc] of porAfiliado.entries()) {
      const existente = mapaExistentes.get(afiliadoIdStr);
      if (existente) {
        if (existente.estado === 'activo') {
          yaActivos++;
          continue;
        }
        // Estaba en baja → reactivar.
        reactivados++;
        if (!dryRun) {
          ops.push(() =>
            this.prisma.coseguroAfiliado.update({
              where: { id: existente.id },
              data: {
                estado: 'activo',
                fechaBaja: null,
                imputacionPadronIdCoseguro:
                  existente.imputacionPadronIdCoseguro ?? acc.padronImputacion,
              },
            }),
          );
        }
      } else {
        // Crear nuevo registro.
        nuevosActivos++;
        if (!dryRun) {
          ops.push(() =>
            this.prisma.coseguroAfiliado.create({
              data: {
                organizacionId,
                afiliadoId: BigInt(afiliadoIdStr),
                fechaAlta: acc.fechaMinima,
                estado: 'activo',
                imputacionPadronIdCoseguro: acc.padronImputacion,
              },
            }),
          );
        }
      }
    }

    // Ejecutar en chunks para no saturar el pool.
    if (!dryRun) {
      const CHUNK = 25;
      for (let i = 0; i < ops.length; i += CHUNK) {
        await Promise.all(ops.slice(i, i + CHUNK).map((fn) => fn()));
      }

      await this.audit.log({
        organizacionId,
        usuarioId: user?.id?.toString(),
        accion: 'COSEGURO_MARCAR_INICIALES_DESDE_MOVIMIENTOS',
        entidad: 'CoseguroAfiliado',
        metadata: {
          afiliadosConJ22: porAfiliado.size,
          yaActivos,
          reactivados,
          nuevosActivos,
        },
      });
    }

    return {
      dryRun,
      afiliadosConJ22: porAfiliado.size,
      yaActivos,
      reactivados,
      nuevosActivos,
    };
  }
}
