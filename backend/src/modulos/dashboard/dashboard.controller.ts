// src/modulos/dashboard/dashboard.controller.ts
import { BadRequestException, Controller, Get, Req } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../../common/prisma.service';

type ReqOrg = { organizacionId?: string };

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

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
      this.prisma.afiliado.count({ where: { organizacionId: org } }),
      this.prisma.afiliado.count({
        where: { organizacionId: org, estado: 'activo' },
      }),
      this.prisma.padron.count({ where: { organizacionId: org } }),
      this.prisma.caja.findFirst({
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
      this.prisma.pago.aggregate({
        where: {
          organizacionId: org,
          fecha: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.ordenCredito.count({
        where: { organizacionId: org, estado: 'pendiente' },
      }),
      this.prisma.ordenCredito.count({
        where: { organizacionId: org, estado: 'en_curso' },
      }),
      this.prisma.comprobanteTercero.count({
        where: {
          organizacionId: org,
          estado: { in: ['borrador', 'emitido', 'contabilizado'] },
        },
      }),
      this.prisma.ordenPagoTercero.count({
        where: { organizacionId: org, estado: 'borrador' },
      }),
      // TODO: reemplazar por count de NovedadLote en estado 'borrador' cuando se codée el nuevo módulo.
      Promise.resolve(0),
      this.prisma.reintegroSolicitud.count({
        where: {
          organizacionId: org,
          estado: {
            in: ['PRESENTADO', 'EN_REVISION', 'OBSERVADO', 'APROBADO', 'A_PAGAR'],
          },
        },
      }),
      this.prisma.afiliado.count({
        where: { organizacionId: org, creadoEn: { gte: startOfMonth } },
      }),
    ]);

    // Verificar si la última caja está realmente abierta (sin asiento de cierre)
    let cajaAbierta = false;
    if (ultimaCaja) {
      const cierre = await this.prisma.asiento.findFirst({
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
