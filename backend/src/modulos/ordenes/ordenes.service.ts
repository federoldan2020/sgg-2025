// src/modulos/ordenes/ordenes.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { CrearOrdenCreditoDto, PreviewOrdenCreditoDto } from './dto';
import { PrismaService } from 'src/common/prisma.service';
import { MovimientosService } from '../movimientos/movimientos.service';

type PreviewCuota = { numero: number; periodoVenc: string; importe: string };
type PreviewResp = {
  afiliadoId: string;
  padronId: string;
  comercioId: string;
  descripcion: string;
  importeTotal: string; // string para precisión/compat
  cantidadCuotas: number;
  periodoPrimera: string; // "YYYY-MM"
  cuotas: PreviewCuota[];
};

@Injectable()
export class OrdenesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly movs: MovimientosService,
  ) {}

  // ====== helpers fecha/periodo ======
  private ensureYYYYMM(periodo?: string): string {
    if (periodo && /^\d{4}-\d{2}$/.test(periodo)) return periodo;
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const yy = next.getFullYear();
    const mm = String(next.getMonth() + 1).padStart(2, '0');
    return `${yy}-${mm}`;
  }

  private addMonths(periodoYYYY_MM: string, add: number): string {
    const y = Number(periodoYYYY_MM.slice(0, 4));
    const m = Number(periodoYYYY_MM.slice(5));
    const d = new Date(y, m - 1 + add, 1);
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yy}-${mm}`;
  }

  private periodoToFirstDay(periodoYYYY_MM?: string): Date {
    const p = this.ensureYYYYMM(periodoYYYY_MM);
    const y = Number(p.slice(0, 4));
    const m = Number(p.slice(5));
    // 12:00 para evitar desfasajes por TZ al serializar
    return new Date(y, m - 1, 1, 12, 0, 0, 0);
  }

  // ====== helpers dinero ======
  private splitAmount(total: number, n: number): string[] {
    const base = Math.floor((total / n) * 100) / 100; // piso a 2 dec
    const arr = Array.from({ length: n }, () => base);
    const suma = base * n;
    let residuo = Math.round((total - suma) * 100); // en centavos

    let i = 0;
    while (residuo > 0 && i < n) {
      arr[i] = Math.round((arr[i] + 0.01) * 100) / 100;
      residuo -= 1;
      i++;
    }
    return arr.map((v) => v.toFixed(2));
  }

  private toBigIntOrFail(id: string, label: string): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException(`ID inválido: ${label}`);
    }
  }

  // ====== validaciones ======
  private async validarAfiliadoPadron(
    organizacionId: string,
    afiliadoIdStr: string,
    padronIdStr: string,
  ) {
    const afiliadoId = this.toBigIntOrFail(afiliadoIdStr, 'afiliadoId');
    const padronId = this.toBigIntOrFail(padronIdStr, 'padronId');

    const [afiliado, padron] = await Promise.all([
      this.prisma.afiliado.findFirst({
        where: { id: afiliadoId, organizacionId },
        select: { id: true },
      }),
      this.prisma.padron.findFirst({
        where: { id: padronId, organizacionId, activo: true },
        select: { id: true, afiliadoId: true, activo: true },
      }),
    ]);

    if (!afiliado) throw new NotFoundException('Afiliado no encontrado');
    if (!padron) throw new NotFoundException('Padrón no encontrado o inactivo');
    if (padron.afiliadoId !== afiliadoId) {
      throw new BadRequestException('El padrón no pertenece al afiliado');
    }
  }

  private async validarComercio(
    organizacionId: string,
    comercioIdStr: string,
    cantidadCuotas: number,
  ) {
    const comercioId = this.toBigIntOrFail(comercioIdStr, 'comercioId');

    const c = await this.prisma.comercio.findFirst({
      where: { id: comercioId, organizacionId, OR: [{ baja: false }, { baja: null }] },
      select: { id: true, cuoMax: true, razonSocial: true },
    });
    if (!c) throw new NotFoundException('Comercio no encontrado o dado de baja');

    if (c.cuoMax && cantidadCuotas > c.cuoMax) {
      throw new BadRequestException(`Máximo de cuotas permitido por el comercio: ${c.cuoMax}`);
    }
    return c;
  }

  // ====== PREVIEW ======
  async preview(organizacionId: string, dto: PreviewOrdenCreditoDto): Promise<PreviewResp> {
    const {
      afiliadoId,
      padronId,
      comercioId,
      descripcion = '',
      monto,
      cuotas,
      periodoPrimera,
    } = dto as any;

    if (!afiliadoId) throw new BadRequestException('Falta afiliadoId');
    if (!padronId) throw new BadRequestException('Falta padronId');
    if (!comercioId) throw new BadRequestException('Falta comercioId');

    // Normalización defensiva
    const montoNum =
      typeof monto === 'string' ? Number(String(monto).replace(',', '.')) : Number(monto);
    const cuotasNum = typeof cuotas === 'string' ? Number(cuotas) : Number(cuotas);

    if (!Number.isFinite(montoNum) || montoNum <= 0)
      throw new BadRequestException('Monto inválido.');
    if (!Number.isInteger(cuotasNum) || cuotasNum < 1)
      throw new BadRequestException('Cuotas inválidas.');

    // Validaciones de dominio
    await this.validarAfiliadoPadron(organizacionId, String(afiliadoId), String(padronId));
    await this.validarComercio(organizacionId, String(comercioId), cuotasNum);

    // (hook tasas/reglas si las hubiera)
    const recargoPct = 0;
    const total = Math.round(montoNum * (1 + recargoPct / 100) * 100) / 100;

    // Periodo de la primera cuota
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const periodo0 = this.ensureYYYYMM(periodoPrimera);

    // Partición de cuotas
    const importes = this.splitAmount(total, cuotasNum);
    const cuotasDet: PreviewCuota[] = importes.map((imp, idx) => ({
      numero: idx + 1,
      periodoVenc: this.addMonths(periodo0, idx),
      importe: imp,
    }));

    return {
      afiliadoId: String(afiliadoId),
      padronId: String(padronId),
      comercioId: String(comercioId),
      descripcion: String(descripcion ?? ''),
      importeTotal: total.toFixed(2),
      cantidadCuotas: cuotasNum,
      periodoPrimera: periodo0,
      cuotas: cuotasDet,
    };
  }

  // ====== CREAR ======
  async crearOrden(organizacionId: string, dto: CrearOrdenCreditoDto) {
    // Usamos preview (valida y normaliza)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const pv = await this.preview(organizacionId, dto as any);

    const afiliadoId = this.toBigIntOrFail(pv.afiliadoId, 'afiliadoId');
    const padronId = this.toBigIntOrFail(pv.padronId, 'padronId');
    const comercio = await this.validarComercio(organizacionId, pv.comercioId, pv.cantidadCuotas);
    const comercioId = comercio.id as unknown as bigint;

    const enCuotas = (dto as any).enCuotas ?? pv.cantidadCuotas > 1;

    return this.prisma.$transaction(async (tx) => {
      // Cabecera
      const orden = await tx.ordenCredito.create({
        data: {
          organizacionId,
          afiliadoId,
          padronId,
          comercioId,
          descripcion: pv.descripcion || `Orden en ${comercio.razonSocial}`,
          fechaAlta: new Date(),
          enCuotas,
          cantidadCuotas: pv.cantidadCuotas,
          cuotaActual: 1,
          importeTotal: new Prisma.Decimal(pv.importeTotal),
          saldoTotal: new Prisma.Decimal(pv.importeTotal),
          periodoPrimera: pv.periodoPrimera,
          tasaInteres: null,
          sistemaAmortizacion: null,
          preMaterializarMeses: null,
          estado: 'pendiente',
          referenciaExterna: null,
          obligacionId: null,
        } satisfies Prisma.OrdenCreditoUncheckedCreateInput,
        select: { id: true },
      });

      // Detalle de cuotas
      await tx.ordenCreditoCuota.createMany({
        data: pv.cuotas.map((c) => ({
          ordenId: orden.id,
          comercioId,
          numero: c.numero,
          periodoVenc: c.periodoVenc,
          importe: new Prisma.Decimal(c.importe),
          cancelado: new Prisma.Decimal(0),
          saldo: new Prisma.Decimal(c.importe),
          estado: 'pendiente',
          obligacionId: null,
          fechaGeneracionObligacion: null,
          fechaCancelacion: null,
        })),
      });

      // ===== Cuenta Corriente: DEBITO en periodoPrimera =====
      // ===== Cuenta Corriente: DEBITOS por cada cuota =====
      for (const c of pv.cuotas) {
        await this.movs.postMovimiento({
          tx: tx as unknown as PrismaClient,
          organizacionId,
          afiliadoId,
          padronId,
          fecha: this.periodoToFirstDay(c.periodoVenc), // 👈 un mes por cuota
          naturaleza: 'debito',
          origen: 'orden_credito',
          concepto: `ORD#${orden.id.toString()} cuota ${c.numero}/${pv.cantidadCuotas} (${c.periodoVenc}) - ${comercio.razonSocial}`,
          importe: c.importe, // 👈 sólo el importe de esa cuota
          ordenId: orden.id,
          // asiento: { ... } (cuando definas los mapeos contables)
        });
      }

      // devolver orden + cuotas
      const creada = await tx.ordenCredito.findUnique({
        where: { id: orden.id },
        include: { cuotas: { orderBy: { numero: 'asc' } } },
      });
      return creada!;
    });
  }

  // ====== LISTAR ======
  async listarPorAfiliado(organizacionId: string, afiliadoIdNum: number) {
    const afiliadoId = BigInt(afiliadoIdNum);
    return this.prisma.ordenCredito.findMany({
      where: { organizacionId, afiliadoId },
      orderBy: { id: 'desc' },
      include: { cuotas: { orderBy: { numero: 'asc' } } },
    });
  }
}
