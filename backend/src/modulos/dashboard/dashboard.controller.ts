// src/modulos/dashboard/dashboard.controller.ts
import { BadRequestException, Controller, Get, Req } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';

const prisma = new PrismaClient();

type ReqOrg = { organizacionId?: string };

@Controller('dashboard')
export class DashboardController {
  /**
   * KPIs agregados para la home, filtrados por organización.
   * Todas las consultas corren en paralelo y devuelven valores serializables.
   */
  @Public() // Alineado al criterio temporal del resto de controllers
  @Get('stats')
  async stats(@Req() req: ReqOrg) {
    const org = req.organizacionId;
    if (!org) throw new BadRequestException('Falta organización');

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(
      startOfDay.getFullYear(),
      startOfDay.getMonth(),
      1,
    );

    const [
      afiliadosTotal,
      afiliadosActivos,
      padronesTotal,
      ultimaCaja,
      pagosHoy,
      ordenesPendientes,
      ordenesEnCurso,
      comprobantesPendientes,
      ordenesPagoBorrador,
      novedadesPendientes,
      reintegrosPendientes,
      afiliadosNuevosMes,
    ] = await Promise.all([
      prisma.afiliado.count({ where: { organizacionId: org } }),
      prisma.afiliado.count({
        where: { organizacionId: org, estado: 'activo' },
      }),
      prisma.padron.count({ where: { organizacionId: org } }),
      prisma.caja.findFirst({
        where: { organizacionId: org },
        orderBy: { id: 'desc' },
        select: {
          id: true,
          sede: true,
          estado: true,
          fechaApertura: true,
          fechaCierre: true,
        },
      }),
      prisma.pago.aggregate({
        where: {
          organizacionId: org,
          fecha: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.ordenCredito.count({
        where: { organizacionId: org, estado: 'pendiente' },
      }),
      prisma.ordenCredito.count({
        where: { organizacionId: org, estado: 'en_curso' },
      }),
      prisma.comprobanteTercero.count({
        where: {
          organizacionId: org,
          estado: { in: ['borrador', 'emitido', 'contabilizado'] },
        },
      }),
      prisma.ordenPagoTercero.count({
        where: { organizacionId: org, estado: 'borrador' },
      }),
      // TODO: reemplazar por count de NovedadLote en estado 'borrador' cuando se codée el nuevo módulo.
      Promise.resolve(0),
      prisma.reintegroSolicitud.count({
        where: {
          organizacionId: org,
          estado: {
            in: ['PRESENTADO', 'EN_REVISION', 'OBSERVADO', 'APROBADO', 'A_PAGAR'],
          },
        },
      }),
      prisma.afiliado.count({
        where: { organizacionId: org, creadoEn: { gte: startOfMonth } },
      }),
    ]);

    // Verificar si la última caja está realmente abierta (sin asiento de cierre)
    let cajaAbierta = false;
    if (ultimaCaja) {
      const cierre = await prisma.asiento.findFirst({
        where: {
          organizacionId: org,
          origen: 'cierre_caja',
          referenciaId: `caja-${ultimaCaja.id.toString()}`,
        },
        select: { id: true },
      });
      cajaAbierta = !cierre && ultimaCaja.estado !== 'cerrada';
    }

    return {
      afiliados: {
        total: afiliadosTotal,
        activos: afiliadosActivos,
        nuevosMes: afiliadosNuevosMes,
      },
      padrones: { total: padronesTotal },
      caja: {
        abierta: cajaAbierta,
        cajaId: ultimaCaja?.id?.toString() ?? null,
        sede: ultimaCaja?.sede ?? null,
        fechaApertura: ultimaCaja?.fechaApertura ?? null,
        cobradoHoy: Number(pagosHoy._sum.total ?? 0),
        cantidadPagosHoy: pagosHoy._count._all,
      },
      ordenes: {
        pendientes: ordenesPendientes,
        enCurso: ordenesEnCurso,
      },
      tesoreria: {
        comprobantesPendientes,
        ordenesPagoBorrador,
      },
      novedades: { pendientes: novedadesPendientes },
      reintegros: { pendientes: reintegrosPendientes },
      generadoEn: new Date().toISOString(),
    };
  }
}
