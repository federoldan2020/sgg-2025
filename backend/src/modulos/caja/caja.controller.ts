// src/modulos/caja/caja.controller.ts
import { Controller, Post, Body, Req, Get, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
const prisma = new PrismaClient();

type MetodoDto = { metodo: string; monto: number; ref?: string };
type AplicacionDto = { obligacionId: number; monto: number };
type ReqOrg = { organizacionId?: string };

@Controller('caja')
export class CajaController {
  constructor(private readonly contab: ContabilidadService) {}

  /* ========= NUEVO: ESTADO ========= */
  @Get('estado')
  async estado(@Req() req: ReqOrg) {
    const org = req.organizacionId;
    if (!org) throw new BadRequestException('Falta organización');

    const last = await prisma.caja.findFirst({
      where: { organizacionId: org },
      orderBy: { id: 'desc' },
      select: { id: true, sede: true },
    });
    if (!last) return { abierta: false, cajaId: null, sede: null };

    const cierre = await prisma.asiento.findFirst({
      where: {
        organizacionId: org,
        origen: 'cierre_caja',
        referenciaId: `caja-${last.id.toString()}`,
      },
      select: { id: true },
    });

    return { abierta: !cierre, cajaId: last.id.toString(), sede: last.sede ?? null };
  }

  @Post('abrir')
  async abrir(@Req() req: ReqOrg, @Body() dto: { sede?: string }) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');
    return prisma.caja.create({ data: { organizacionId: org, sede: dto.sede ?? null } });
  }

  @Post('cobrar')
  async cobrar(
    @Req() req: ReqOrg,
    @Body()
    dto: {
      cajaId: number;
      afiliadoId: number;
      metodos: MetodoDto[];
      aplicaciones: AplicacionDto[];
    },
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    const totalMetodos = dto.metodos.reduce((a, b) => a + Number(b.monto), 0);
    const totalAplic = dto.aplicaciones.reduce((a, b) => a + Number(b.monto), 0);
    if (Number(totalMetodos.toFixed(2)) !== Number(totalAplic.toFixed(2))) {
      throw new Error('La suma de métodos debe igualar la suma aplicada');
    }

    return prisma.$transaction(async (tx) => {
      const pago = await tx.pago.create({
        data: {
          organizacionId: org,
          cajaId: BigInt(dto.cajaId),
          afiliadoId: BigInt(dto.afiliadoId),
          total: totalMetodos,
          numeroRecibo: null,
          origen: 'caja',
        },
      });

      for (const m of dto.metodos) {
        await tx.metodoPago.create({
          data: { pagoId: pago.id, metodo: m.metodo, monto: m.monto, ref: m.ref ?? null },
        });
      }

      const idsObl = dto.aplicaciones.map((a) => BigInt(a.obligacionId));
      const obligaciones = await tx.obligacion.findMany({
        where: { id: { in: idsObl } },
        include: { concepto: true },
      });
      const mapaObl = new Map(obligaciones.map((o) => [o.id.toString(), o]));

      for (const a of dto.aplicaciones) {
        const obl = mapaObl.get(BigInt(a.obligacionId).toString());
        if (!obl || obl.organizacionId !== org) throw new Error('Obligación inválida');
        const nuevoSaldo = Number(obl.saldo) - Number(a.monto);
        if (nuevoSaldo < -0.01) throw new Error('Aplicación supera saldo');

        await tx.obligacion.update({
          where: { id: obl.id },
          data: {
            saldo: nuevoSaldo,
            estado: nuevoSaldo <= 0.009 ? 'pagada' : 'parcialmente_pagada',
          },
        });

        await tx.aplicacion.create({
          data: { pagoId: pago.id, obligacionId: obl.id, monto: a.monto },
        });
      }

      // ======================= CONTABILIDAD =======================
      const mapeos = await tx.cuentaMapeo.findMany({
        where: { organizacionId: org, origen: 'pago_caja', activo: true },
      });

      const pickMap = (opts: { conceptoCodigo?: string | null; metodo?: string | null }) => {
        const { conceptoCodigo, metodo } = opts;
        return (
          mapeos.find((m) => m.conceptoCodigo === conceptoCodigo && m.metodoPago === metodo) ??
          mapeos.find((m) => m.conceptoCodigo === conceptoCodigo && m.metodoPago == null) ??
          mapeos.find((m) => m.conceptoCodigo == null && m.metodoPago === metodo) ??
          mapeos.find((m) => m.conceptoCodigo == null && m.metodoPago == null) ??
          null
        );
      };

      const lineasDebe: Record<string, number> = {};
      const lineasHaber: Record<string, number> = {};

      // DEBE por método
      for (const m of dto.metodos) {
        const map = pickMap({ metodo: m.metodo, conceptoCodigo: null });
        const cuentaDebe = map?.debeCodigo ?? (m.metodo === 'efectivo' ? '1101' : '1102');
        lineasDebe[cuentaDebe] = (lineasDebe[cuentaDebe] ?? 0) + Number(m.monto);
      }

      // HABER por concepto
      for (const a of dto.aplicaciones) {
        const obl = mapaObl.get(BigInt(a.obligacionId).toString())!;
        const conceptoCodigo = obl.concepto?.codigo ?? null;
        const metodoPrincipal = dto.metodos[0]?.metodo ?? null;

        const map = pickMap({ metodo: metodoPrincipal, conceptoCodigo });
        let defHaber = '4101';
        if (conceptoCodigo === 'ORDEN_CREDITO') defHaber = '4102';
        const cuentaHaber = map?.haberCodigo ?? defHaber;

        lineasHaber[cuentaHaber] = (lineasHaber[cuentaHaber] ?? 0) + Number(a.monto);
      }

      const totalDebe = Object.values(lineasDebe).reduce((a, b) => a + b, 0);
      const totalHaber = Object.values(lineasHaber).reduce((a, b) => a + b, 0);
      const diff = Number((totalDebe - totalHaber).toFixed(2));
      if (Math.abs(diff) > 0.01) {
        if (diff > 0) lineasHaber['1301'] = (lineasHaber['1301'] ?? 0) + diff;
        else lineasDebe['1301'] = (lineasDebe['1301'] ?? 0) + -diff;
      }

      await tx.asiento.create({
        data: {
          organizacionId: org,
          descripcion: `Pago en Caja ID ${pago.id.toString()}`,
          origen: 'pago_caja',
          referenciaId: pago.id.toString(),
          lineas: {
            create: [
              ...Object.entries(lineasDebe).map(([cuenta, importe]) => ({
                cuenta,
                debe: importe,
                haber: 0,
              })),
              ...Object.entries(lineasHaber).map(([cuenta, importe]) => ({
                cuenta,
                debe: 0,
                haber: importe,
              })),
            ],
          },
        },
      });
      // ======================= /CONTABILIDAD ======================

      return tx.pago.findUnique({
        where: { id: pago.id },
        include: { metodos: true, aplicaciones: { include: { obligacion: true } } },
      });
    });
  }

  /**
   * Cierre ciego de caja:
   * - Recibe montos del front (teórico + declarado) y opcional metodoPago
   * - Genera asiento de ajuste solo si hay diferencia
   */
  // src/modulos/caja/caja.controller.ts
  @Post('cerrar')
  async cerrar(
    @Req() req: ReqOrg,
    @Body()
    body:
      | {
          // MODO 1 (simple, compat hacia atrás)
          montoDeclarado: number;
          montoTeorico: number;
          metodoPago?: string | null;
          referenciaId?: string | null;
          descripcion?: string | null;
        }
      | {
          // MODO 2 (lote por método)
          items: Array<{ metodo: string | null; declarado: number; teorico: number }>;
          referenciaId?: string | null;
          descripcion?: string | null;
        },
  ) {
    const org = req.organizacionId;
    if (!org) throw new Error('Falta organización');

    return prisma.$transaction(async (tx) => {
      // --- MODO 2: lote por método
      if ('items' in body && Array.isArray(body.items) && body.items.length > 0) {
        const itemsValidos = (body.items ?? [])
          .map((i) => ({
            metodoPago: i.metodo ?? null,
            declarado: Number(i.declarado) || 0,
            teorico: Number(i.teorico) || 0,
          }))
          .filter((i) => Number.isFinite(i.declarado) && Number.isFinite(i.teorico));

        if (itemsValidos.length === 0) {
          throw new Error('Items de cierre inválidos');
        }
        const { diffTotal, lineas } = await this.contab.lineasCierreCajaLote(
          org,
          body.items.map((it) => ({
            metodoPago: it.metodo ?? null,
            declarado: it.declarado,
            teorico: it.teorico,
          })),
        );

        if (lineas.length === 0) {
          return { diff: diffTotal, asientoId: null, ok: true, mensaje: 'Cierre sin diferencias.' };
        }

        const asiento = await this.contab.crearAsiento(tx, {
          organizacionId: org,
          descripcion: body.descripcion ?? 'Cierre de caja (lote por método)',
          origen: 'cierre_caja',
          referenciaId: body.referenciaId ?? null,
          lineas,
        });

        return { diff: diffTotal, asientoId: asiento.id.toString(), ok: true };
      }

      // --- MODO 1: simple (el que ya tenías)
      const { montoDeclarado, montoTeorico, metodoPago = null, referenciaId = null } = body as any;

      const { diff, lineas } = await this.contab.lineasCierreCaja(org, {
        montoDeclarado,
        montoTeorico,
        metodoPago,
      });

      if (lineas.length === 0) {
        return { diff, asientoId: null, mensaje: 'Cierre sin diferencia: no se generó asiento.' };
      }

      const asiento = await this.contab.crearAsiento(tx, {
        organizacionId: org,
        descripcion: (body as any).descripcion ?? `Cierre de caja (${metodoPago ?? 'general'})`,
        origen: 'cierre_caja',
        referenciaId,
        lineas,
      });

      return { diff, asientoId: asiento.id.toString(), ok: true };
    });
  }
}
