import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ParametrosService } from './parametros.service';

/**
 * Calcula la cobertura mensual del afiliado y la materializa en
 * `CoberturaAfiliadoPeriodo`. Convierte el problema de "no sé cuánto me debe"
 * en "le cobré al menos el mínimo o no":
 *
 *   deuda_código = max(0, esperado − cobrado)
 *
 * Los `cobrado` salen del padrón vigente del afiliado en el período. El
 * service NO conoce el TXT directamente: lo que importa es que cuando el
 * procesador de TXT (módulo nómina) o caja actualicen los importes, llamen
 * a `recalcular(afiliadoId, periodo)`.
 */

const PERIODO_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function periodoToDate(periodo: string): Date {
  if (!PERIODO_REGEX.test(periodo)) {
    throw new BadRequestException(`Periodo inválido: ${periodo} (esperado YYYY-MM)`);
  }
  const [y, m] = periodo.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

export type CoberturaResultado = {
  afiliadoId: string;
  periodo: string;
  j17Esperado: number;
  j17Cobrado: number;
  j22Esperado: number;
  j22Cobrado: number;
  j38Esperado: number;
  j38Cobrado: number;
  k16Esperado: number;
  k16Cobrado: number;
  /** Flags por concepto (modelo de gates separados). */
  j17Cubierto: boolean;
  j22Cubierto: boolean;
  j38Cubierto: boolean;
  /** Derivado: j17Cubierto && j22Cubierto && j38Cubierto. */
  cubierto: boolean;
  deudaTotal: number;
  /** Desglose por código para presentación. */
  detalle: {
    j17: { esperado: number; cobrado: number; deuda: number };
    j22: { esperado: number; cobrado: number; deuda: number };
    j38: { esperado: number; cobrado: number; deuda: number };
    k16: { esperado: number; cobrado: number; deuda: number };
  };
};

@Injectable()
export class CoberturaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametros: ParametrosService,
  ) {}

  /**
   * Reglas de cálculo:
   *  - J17 esperado = J17_CUOTA_04 vigente si afiliado tiene padrón con situacion '04';
   *                    sino J17_MINIMO vigente.
   *  - J17 cobrado  = suma del campo `j17` de los padrones activos del afiliado.
   *  - J22 esperado = ReglaPrecioCoseguro vigente, si el afiliado tiene coseguro vigente.
   *  - J38 esperado = ReglaPrecioColateral vigente (según cantidad de colaterales activos).
   *  - K16 esperado = suma de cuota K16 declarada en padrones (mismo período).
   *  - Todos los `cobrado` quedan en 0 si no hay registro real — la
   *    integración con el TXT de retorno (que actualiza esos importes en
   *    `Padron`) lo va a llenar.
   */
  async calcular(
    organizacionId: string,
    afiliadoId: bigint,
    periodo: string,
  ): Promise<CoberturaResultado> {
    const fechaPeriodo = periodoToDate(periodo);

    const afiliado = await this.prisma.afiliado.findFirst({
      where: { organizacionId, id: afiliadoId },
      include: {
        padrones: true,
        coseguro: true,
        Colateral: { where: { activo: true } },
      },
    });
    if (!afiliado) throw new BadRequestException('Afiliado no encontrado');

    const padronesActivos = afiliado.padrones.filter((p) => p.activo);
    const es04 = padronesActivos.some((p) => (p.situacion ?? '').toUpperCase() === '04');

    // ---------- COBRADO: suma de MovimientoAfiliado del período (nómina + caja) ----------
    const movimientos = await this.prisma.movimientoAfiliado.findMany({
      where: {
        organizacionId,
        afiliadoId,
        periodoContable: periodo,
        naturaleza: 'credito',
        origen: { in: ['nomina', 'pago_caja'] },
      },
      select: { concepto: true, importe: true },
    });

    let j17Cobrado = 0;
    let j22Cobrado = 0;
    let j38Cobrado = 0;
    let k16Cobrado = 0;
    for (const m of movimientos) {
      const importe = Number(m.importe);
      const c = m.concepto.toUpperCase();
      if (c.startsWith('J17')) j17Cobrado += importe;
      else if (c.startsWith('J22')) j22Cobrado += importe;
      else if (c.startsWith('J38')) j38Cobrado += importe;
      else if (c.startsWith('K16')) k16Cobrado += importe;
    }

    // ---------- J17 esperado ----------
    const j17ParamTipo = es04 ? 'J17_CUOTA_04' : 'J17_MINIMO';
    const j17Param = await this.parametros.getVigente(organizacionId, fechaPeriodo, j17ParamTipo);
    const j17Esperado = j17Param?.valor ?? 0;

    // ---------- J22 esperado ----------
    let j22Esperado = 0;
    if (afiliado.coseguro && afiliado.coseguro.estado === 'activo') {
      const reglaJ22 = await this.prisma.reglaPrecioCoseguro.findFirst({
        where: {
          organizacionId,
          activo: true,
          vigenteDesde: { lte: fechaPeriodo },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaPeriodo } }],
        },
        orderBy: { vigenteDesde: 'desc' },
      });
      j22Esperado = Number(reglaJ22?.precioBase ?? 0);
    }

    // ---------- J38 esperado ----------
    let j38Esperado = 0;
    const cantidadColaterales = afiliado.Colateral.length;
    if (cantidadColaterales > 0 && afiliado.coseguro?.estado === 'activo') {
      const reglas = await this.prisma.reglaPrecioColateral.findMany({
        where: {
          organizacionId,
          activo: true,
          vigenteDesde: { lte: fechaPeriodo },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fechaPeriodo } }],
          cantidadDesde: { lte: cantidadColaterales },
        },
        orderBy: { vigenteDesde: 'desc' },
      });
      const reglaAplicable = reglas.find(
        (r) => r.cantidadHasta == null || r.cantidadHasta >= cantidadColaterales,
      );
      j38Esperado = Number(reglaAplicable?.precioTotal ?? 0);
    }

    // ---------- K16 esperado ----------
    // Hoy `Padron.k16` representa la cuota de orden de crédito vigente del padrón.
    // El TXT NO la sobreescribe; la cobertura suma sólo lo cobrado vs esperado.
    const k16Esperado = padronesActivos.reduce((acc, p) => acc + Number(p.k16 ?? 0), 0);

    // ---------- Deuda + flags por concepto ----------
    const deudaJ17 = Math.max(0, j17Esperado - j17Cobrado);
    const deudaJ22 = Math.max(0, j22Esperado - j22Cobrado);
    const deudaJ38 = Math.max(0, j38Esperado - j38Cobrado);
    const deudaK16 = Math.max(0, k16Esperado - k16Cobrado);
    const deudaTotal = deudaJ17 + deudaJ22 + deudaJ38 + deudaK16;

    // Flag por concepto: true cuando no aplica (sin coseguro / sin colaterales)
    // o cuando lo cobrado alcanzó lo esperado.
    const j17Cubierto = j17Esperado === 0 || j17Cobrado >= j17Esperado;
    const j22Cubierto = j22Esperado === 0 || j22Cobrado >= j22Esperado;
    const j38Cubierto = j38Esperado === 0 || j38Cobrado >= j38Esperado;
    // `cubierto` agregado se mantiene como derivado para compatibilidad.
    // No se considera K16 acá porque K16 no determina estado del afiliado
    // ni del coseguro (sólo afecta cupo).
    const cubierto = j17Cubierto && j22Cubierto && j38Cubierto;

    // ---------- Persistir ----------
    await this.prisma.coberturaAfiliadoPeriodo.upsert({
      where: {
        cobertura_unique_org_afiliado_periodo: {
          organizacionId,
          afiliadoId,
          periodo,
        },
      },
      update: {
        j17Esperado,
        j17Cobrado,
        j22Esperado,
        j22Cobrado,
        j38Esperado,
        j38Cobrado,
        k16Esperado,
        k16Cobrado,
        cubierto,
        j17Cubierto,
        j22Cubierto,
        j38Cubierto,
        deudaTotal,
        calculadoEn: new Date(),
      },
      create: {
        organizacionId,
        afiliadoId,
        periodo,
        j17Esperado,
        j17Cobrado,
        j22Esperado,
        j22Cobrado,
        j38Esperado,
        j38Cobrado,
        k16Esperado,
        k16Cobrado,
        cubierto,
        j17Cubierto,
        j22Cubierto,
        j38Cubierto,
        deudaTotal,
      },
    });

    return {
      afiliadoId: afiliadoId.toString(),
      periodo,
      j17Esperado,
      j17Cobrado,
      j22Esperado,
      j22Cobrado,
      j38Esperado,
      j38Cobrado,
      k16Esperado,
      k16Cobrado,
      j17Cubierto,
      j22Cubierto,
      j38Cubierto,
      cubierto,
      deudaTotal,
      detalle: {
        j17: { esperado: j17Esperado, cobrado: j17Cobrado, deuda: deudaJ17 },
        j22: { esperado: j22Esperado, cobrado: j22Cobrado, deuda: deudaJ22 },
        j38: { esperado: j38Esperado, cobrado: j38Cobrado, deuda: deudaJ38 },
        k16: { esperado: k16Esperado, cobrado: k16Cobrado, deuda: deudaK16 },
      },
    };
  }

  /** Cobertura ya materializada. Si no existe, la calcula. */
  async obtener(organizacionId: string, afiliadoId: bigint, periodo: string) {
    const existente = await this.prisma.coberturaAfiliadoPeriodo.findUnique({
      where: {
        cobertura_unique_org_afiliado_periodo: {
          organizacionId,
          afiliadoId,
          periodo,
        },
      },
    });
    if (existente) {
      const j17Esperado = Number(existente.j17Esperado);
      const j17Cobrado = Number(existente.j17Cobrado);
      const j22Esperado = Number(existente.j22Esperado);
      const j22Cobrado = Number(existente.j22Cobrado);
      const j38Esperado = Number(existente.j38Esperado);
      const j38Cobrado = Number(existente.j38Cobrado);
      const k16Esperado = Number(existente.k16Esperado);
      const k16Cobrado = Number(existente.k16Cobrado);
      return {
        ...existente,
        id: existente.id.toString(),
        afiliadoId: existente.afiliadoId.toString(),
        j17Esperado,
        j17Cobrado,
        j22Esperado,
        j22Cobrado,
        j38Esperado,
        j38Cobrado,
        k16Esperado,
        k16Cobrado,
        deudaTotal: Number(existente.deudaTotal),
        detalle: {
          j17: { esperado: j17Esperado, cobrado: j17Cobrado, deuda: Math.max(0, j17Esperado - j17Cobrado) },
          j22: { esperado: j22Esperado, cobrado: j22Cobrado, deuda: Math.max(0, j22Esperado - j22Cobrado) },
          j38: { esperado: j38Esperado, cobrado: j38Cobrado, deuda: Math.max(0, j38Esperado - j38Cobrado) },
          k16: { esperado: k16Esperado, cobrado: k16Cobrado, deuda: Math.max(0, k16Esperado - k16Cobrado) },
        },
      };
    }
    return this.calcular(organizacionId, afiliadoId, periodo);
  }

  /** Historial de cobertura de los últimos N períodos. */
  async historial(organizacionId: string, afiliadoId: bigint, ultimosNPeriodos = 6) {
    const items = await this.prisma.coberturaAfiliadoPeriodo.findMany({
      where: { organizacionId, afiliadoId },
      orderBy: { periodo: 'desc' },
      take: ultimosNPeriodos,
    });
    return items.map((c) => ({
      ...c,
      id: c.id.toString(),
      afiliadoId: c.afiliadoId.toString(),
      j17Esperado: Number(c.j17Esperado),
      j17Cobrado: Number(c.j17Cobrado),
      j22Esperado: Number(c.j22Esperado),
      j22Cobrado: Number(c.j22Cobrado),
      j38Esperado: Number(c.j38Esperado),
      j38Cobrado: Number(c.j38Cobrado),
      k16Esperado: Number(c.k16Esperado),
      k16Cobrado: Number(c.k16Cobrado),
      deudaTotal: Number(c.deudaTotal),
    }));
  }
}
