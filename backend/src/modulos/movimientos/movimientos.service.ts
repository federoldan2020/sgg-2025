// src/modulos/movimientos/movimientos.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma.service';

type Moneda = 'ARS' | 'USD';

type PostParams = {
  tx?: Prisma.TransactionClient; // <- TransactionClient
  organizacionId: string;
  afiliadoId: bigint;
  padronId?: bigint | null;
  fecha?: Date;
  naturaleza: 'debito' | 'credito';
  origen:
    | 'orden_credito'
    | 'cuota'
    | 'pago_caja'
    | 'nomina'
    | 'ajuste'
    | 'anulacion'
    | 'aplicacion_saldo_favor';
  concepto: string;

  /** Si trabajás en ARS, pasá `importe`. Si es USD, podés omitir `importe` y pasar (moneda, importeMoneda, tcAplicado). */
  importe?: number | string; // ARS base (opcional si usás moneda extranjera)
  moneda?: Moneda; // traza opcional de moneda original
  importeMoneda?: number | string; // en la moneda original
  tcAplicado?: number | string; // TC usado para convertir a ARS

  // trazas opcionales
  obligacionId?: bigint | null;
  ordenId?: bigint | null;
  cuotaId?: bigint | null;
  pagoId?: bigint | null;
  
  // Período contable: formato "YYYY-MM" para agrupar movimientos por período
  periodoContable?: string | null;

  /**
   * Si false, el movimiento se registra pero NO afecta el saldo del padrón.
   * Útil para J17, J22, J38 que son descuentos informativos (no hay deuda previa registrada).
   * Default: true
   */
  afectaSaldo?: boolean;

  /**
   * Fase 2: marcar este movimiento como "requiere revisión" — se usa para
   * créditos de cobranza que no pudieron matchearse contra una Obligación
   * del período (cobranza huérfana). El saldo se actualiza igual, pero
   * el operador tiene que revisar el caso.
   */
  requiereRevision?: boolean;

  /**
   * Fase 2: si este débito fue cubierto automáticamente por saldo a favor
   * del padrón al momento de su creación, este campo apunta al movimiento
   * crédito original que se está consumiendo.
   */
  aplicaSaldoFavorId?: bigint | null;

  // contabilidad (opcional)
  asiento?: {
    descripcion: string;
    referenciaId?: string;
    // mapeo
    conceptoCodigo?: string | null;
    metodoPago?: string | null;
    /** Para elegir mapeo por moneda (si tu CuentaMapeo lo soporta) y dejar traza en Asiento */
    moneda?: Moneda | null;
    tc?: number | string | null;
  };
};

@Injectable()
export class MovimientosService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== helpers num/decimal =====
  private toNum(n: number | string | undefined | null, def = 0) {
    const v = n == null ? def : Number(n);
    return Number.isFinite(v) ? v : def;
  }
  private dec(n: number | string) {
    return new Prisma.Decimal(n);
  }

  /**
   * Crea el movimiento (submayor afiliado) y, opcionalmente, el asiento contable.
   * Soporta ARS directo o USD con TC -> convierte a ARS para saldo/asiento.
   * - Si viene `tx`, NO abre nueva transacción.
   * - Si no viene `tx`, abre `this.prisma.$transaction`.
   */
  async postMovimiento(p: PostParams) {
    const fecha = p.fecha ?? new Date();

    // ===== 1) Determinar importe en ARS (base contable) =====
    let importeArs: number | undefined = undefined;

    if (p.importe != null) {
      // Ruta clásica: ya viene en ARS
      importeArs = this.toNum(p.importe);
    } else if (p.moneda && p.moneda !== 'ARS') {
      // Ruta FX: USD => ARS
      const im = this.toNum(p.importeMoneda);
      const tc = this.toNum(p.tcAplicado);
      if (!im || !tc) {
        throw new BadRequestException(
          'Para moneda extranjera indicá importeMoneda y tcAplicado (> 0).',
        );
      }
      importeArs = im * tc;
    }

    if (!importeArs || !Number.isFinite(importeArs) || importeArs <= 0) {
      throw new BadRequestException('Importe inválido (> 0).');
    }

    // Por defecto, los movimientos afectan el saldo
    const afectaSaldo = p.afectaSaldo !== false;

    const run = async (tx: Prisma.TransactionClient) => {
      // ===== 2) Lock pesimista del padrón =====
      // El saldo es POR PADRÓN, así que tomamos lock exclusivo de esa fila para
      // evitar race conditions cuando dos transacciones operan sobre el mismo
      // padrón en paralelo (ej: cobro caja + cobranza nómina simultáneos).
      // El lock se mantiene hasta el commit de la tx.
      // Para movimientos sin padrón (ajustes globales), no hay nada que bloquear.
      if (p.padronId) {
        await tx.$queryRaw`SELECT id FROM "Padron" WHERE id = ${p.padronId} FOR UPDATE`;
      }

      // ===== 3) Último saldo (para saldoPosterior) =====
      // Fuente de verdad: el último saldoPosterior del padrón en MovimientoAfiliado.
      // Para padronId=null, usamos los movimientos huérfanos del afiliado.
      const whereLastMov: Prisma.MovimientoAfiliadoWhereInput = {
        organizacionId: p.organizacionId,
        afiliadoId: p.afiliadoId,
        padronId: p.padronId ?? null,
      };

      const last = await tx.movimientoAfiliado.findFirst({
        where: whereLastMov,
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        select: { saldoPosterior: true },
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const prevSaldo = this.toNum(last?.saldoPosterior as any, 0);

      // Si afectaSaldo = false, el movimiento NO modifica el saldo (es solo informativo)
      // Útil para J17, J22, J38 que son descuentos sin deuda previa registrada
      const delta = afectaSaldo ? (importeArs * (p.naturaleza === 'credito' ? -1 : 1)) : 0;
      const nuevoSaldo = prevSaldo + delta;

      // ===== 3) Asiento opcional =====
      let asientoId: bigint | null = null;

      if (p.asiento) {
        // Si vas a discriminar por moneda en CuentaMapeo, este campo debe existir en el schema:
        //   moneda Moneda?  (null = aplica a cualquier)
        const mapeo = await tx.cuentaMapeo.findFirst({
          where: {
            organizacionId: p.organizacionId,
            origen: p.origen,
            activo: true,
            conceptoCodigo: p.asiento.conceptoCodigo ?? null,
            metodoPago: p.asiento.metodoPago ?? null,
            // Si tu schema NO tiene "moneda" en CuentaMapeo, remové esta línea:
            moneda: (p.asiento.moneda as any) ?? null,
          },
          select: { debeCodigo: true, haberCodigo: true },
        });

        if (!mapeo) {
          throw new BadRequestException(
            `CuentaMapeo faltante para origen=${p.origen} concepto=${p.asiento.conceptoCodigo ?? '-'} metodo=${p.asiento.metodoPago ?? '-'} moneda=${p.asiento.moneda ?? '-'}`,
          );
        }

        const asiento = await tx.asiento.create({
          data: {
            organizacionId: p.organizacionId,
            fecha,
            origen: p.origen,
            descripcion: p.asiento.descripcion,
            referenciaId: p.asiento.referenciaId ?? null,
            // Si agregaste metadata en Asiento:
            // moneda: (p.asiento.moneda as any) ?? null,
            // tc: p.asiento.tc != null ? this.dec(p.asiento.tc) : null,
            lineas: {
              create: [
                { cuenta: mapeo.debeCodigo, debe: this.dec(importeArs), haber: this.dec(0) },
                { cuenta: mapeo.haberCodigo, debe: this.dec(0), haber: this.dec(importeArs) },
              ],
            },
          },
          select: { id: true },
        });
        asientoId = asiento.id as unknown as bigint;
      }

      // ===== 4) Movimiento submayor afiliado (con traza FX si aplica) =====
      const mov = await tx.movimientoAfiliado.create({
        data: {
          organizacionId: p.organizacionId,
          afiliadoId: p.afiliadoId,
          padronId: p.padronId ?? null,
          fecha,
          naturaleza: p.naturaleza === 'credito' ? 'credito' : 'debito',
          origen: p.origen,
          concepto: p.concepto,
          importe: this.dec(importeArs), // ARS
          // FX (opcional; si tu tabla los tiene)
          moneda: (p.moneda as any) ?? null,
          importeMoneda: p.importeMoneda != null ? this.dec(p.importeMoneda) : null,
          tcAplicado: p.tcAplicado != null ? this.dec(p.tcAplicado) : null,

          // vínculos
          obligacionId: p.obligacionId ?? null,
          ordenId: p.ordenId ?? null,
          cuotaId: p.cuotaId ?? null,
          pagoId: p.pagoId ?? null,

          // Período contable para agrupar por período cuando corresponde
          periodoContable: p.periodoContable ?? null,

          // Fase 2 — bandera de revisión y traza de saldo a favor aplicado
          requiereRevision: p.requiereRevision === true,
          aplicaSaldoFavorId: p.aplicaSaldoFavorId ?? null,

          saldoPosterior: this.dec(nuevoSaldo),
          asientoId,
        },
      });

      // ===== 5) Refrescar saldos cacheados =====
      // Padron.saldo = fuente de verdad por padrón (modelo unificado, ver
      // memory/project_modelo_saldos.md). Solo se actualiza si el movimiento
      // afecta saldo y tiene padrón.
      if (afectaSaldo && p.padronId) {
        await tx.padron.update({
          where: { id: p.padronId },
          data: { saldo: this.dec(nuevoSaldo) },
        });
      }

      // Afiliado.saldo: legacy, queda como copia del último saldo tocado.
      // En Fase 3 pasa a ser derivado (suma de saldos de padrones) o se elimina.
      if (afectaSaldo) {
        await tx.afiliado.update({
          where: { id: p.afiliadoId },
          data: { saldo: this.dec(nuevoSaldo) },
        });
      }

      return mov;
    };

    if (p.tx) return run(p.tx);
    return this.prisma.$transaction(run);
  }

  // ===========================================================================
  // Fase 2 — Conciliación de cobranza con matching automático contra obligaciones
  // ===========================================================================

  /**
   * Registra una línea de cobranza (Cómputos / ANSES / Caja) realizando el
   * matching automático contra las Obligaciones del padrón+concepto.
   *
   * Comportamiento:
   *  1. Busca obligaciones del padrón+concepto con saldo > 0, ordenadas FIFO
   *     por período ascendente (las más viejas primero).
   *  2. Aplica el importe cobrado contra cada obligación hasta agotarlo.
   *     Por cada obligación afectada genera un MovimientoAfiliado(crédito)
   *     vinculado con `obligacionId` y actualiza `Obligacion.saldo/estado`.
   *  3. Si sobra cobranza tras agotar las obligaciones: genera UN crédito
   *     huérfano (saldo a favor) con `requiereRevision=true`.
   *  4. Si NO había ninguna obligación que matchear: genera UN crédito
   *     huérfano con `requiereRevision=true`.
   *
   * Devuelve detalle de cómo se distribuyó el monto cobrado, útil para
   * estadísticas del lote de importación.
   */
  async registrarCobranza(p: {
    tx: Prisma.TransactionClient;
    organizacionId: string;
    afiliadoId: bigint;
    padronId: bigint;
    conceptoCodigo: string; // 'CUOTA_SOC' | 'COSEGURO' | 'ADIC_COL' | 'ORDEN_CREDITO'
    conceptoLabel: string; // p.ej. "J22 - Coseguro"
    importe: number;
    fecha: Date;
    periodo: string; // 'YYYY-MM'
    origen: 'nomina' | 'pago_caja';
    pagoId?: bigint | null;
    /**
     * Si true, en lugar de generar crédito huérfano cuando no hay obligación,
     * crea la obligación con `monto=importe` y la aplica de inmediato.
     * Pensado para conceptos porcentuales (J17/CUOTA_SOC): el monto solo se
     * conoce cuando llega el descuento de nómina, por lo que la deuda y el
     * pago se materializan al mismo tiempo desde Cómputos/ANSES.
     */
    autoCrearObligacionSiFalta?: boolean;
  }): Promise<{
    obligacionesAplicadas: number;
    pagadasTotal: number;
    parciales: number;
    excedente: number; // monto remanente que quedó como saldo a favor
    sinObligacion: boolean;
  }> {
    const { tx } = p;
    const stats = {
      obligacionesAplicadas: 0,
      pagadasTotal: 0,
      parciales: 0,
      excedente: 0,
      sinObligacion: false,
    };

    if (p.importe <= 0) return stats;

    // Resolver conceptoId desde el código.
    const concepto = await tx.concepto.findFirst({
      where: { organizacionId: p.organizacionId, codigo: p.conceptoCodigo },
      select: { id: true },
    });
    if (!concepto) {
      // Concepto no existe: registramos crédito huérfano con revisión.
      await this.postMovimiento({
        tx,
        organizacionId: p.organizacionId,
        afiliadoId: p.afiliadoId,
        padronId: p.padronId,
        fecha: p.fecha,
        naturaleza: 'credito',
        origen: p.origen,
        concepto: `${p.conceptoLabel} (sin concepto en BD)`,
        importe: p.importe,
        periodoContable: p.periodo,
        pagoId: p.pagoId ?? null,
        requiereRevision: true,
      });
      stats.excedente = p.importe;
      stats.sinObligacion = true;
      return stats;
    }

    // Buscar obligaciones del padrón+concepto pendientes, FIFO por período.
    // Aceptamos obligaciones de períodos anteriores o iguales al cobrado.
    const obls = await tx.obligacion.findMany({
      where: {
        organizacionId: p.organizacionId,
        padronId: p.padronId,
        conceptoId: concepto.id,
        periodo: { lte: p.periodo },
        saldo: { gt: 0 },
        estado: { in: ['pendiente', 'parcialmente_pagada'] },
      },
      orderBy: [{ periodo: 'asc' }, { creadoEn: 'asc' }],
      select: { id: true, saldo: true, monto: true, periodo: true, conciliacionImporte: true },
    });

    // Caso J17 (porcentual): si no hay obligación que matchear, la creamos
    // con monto=importe del descuento. La materialización y el pago ocurren
    // en el mismo paso. La nueva obligación se agrega al array para que el
    // loop la consuma de inmediato.
    if (
      p.autoCrearObligacionSiFalta &&
      obls.length === 0 &&
      p.importe > 0
    ) {
      const nueva = await tx.obligacion.create({
        data: {
          organizacionId: p.organizacionId,
          afiliadoId: p.afiliadoId,
          padronId: p.padronId,
          conceptoId: concepto.id,
          periodo: p.periodo,
          origen: 'conciliacion_nomina',
          monto: this.dec(p.importe),
          saldo: this.dec(p.importe),
          estado: 'pendiente',
          bloqueada: false,
        },
        select: {
          id: true,
          saldo: true,
          monto: true,
          periodo: true,
          conciliacionImporte: true,
        },
      });
      obls.push(nueva);
    }

    let restante = Math.round(p.importe * 100) / 100;
    const ahora = p.fecha;

    for (const o of obls) {
      if (restante <= 0.009) break;
      const saldoObl = Number(o.saldo);
      const aplica = Math.min(saldoObl, restante);
      const nuevoSaldo = Math.round((saldoObl - aplica) * 100) / 100;
      const pagada = nuevoSaldo <= 0.009;

      // Crear movimiento crédito vinculado a esta obligación.
      await this.postMovimiento({
        tx,
        organizacionId: p.organizacionId,
        afiliadoId: p.afiliadoId,
        padronId: p.padronId,
        fecha: p.fecha,
        naturaleza: 'credito',
        origen: p.origen,
        concepto: `${p.conceptoLabel} ${o.periodo}`,
        importe: aplica,
        obligacionId: o.id,
        periodoContable: o.periodo,
        pagoId: p.pagoId ?? null,
      });

      // Actualizar saldo / estado / conciliación de la obligación.
      const concImp =
        Math.round((Number(o.conciliacionImporte ?? 0) + aplica) * 100) / 100;
      await tx.obligacion.update({
        where: { id: o.id },
        data: {
          saldo: nuevoSaldo,
          estado: pagada ? 'pagada' : 'parcialmente_pagada',
          conciliacionEstado: pagada ? 'descontado' : 'parcial',
          conciliacionImporte: concImp,
          conciliacionFecha: ahora,
        },
      });

      stats.obligacionesAplicadas++;
      if (pagada) stats.pagadasTotal++;
      else stats.parciales++;

      restante = Math.round((restante - aplica) * 100) / 100;
    }

    // Lo que sobró tras agotar obligaciones.
    if (restante > 0.009) {
      const sinObligacionMatch = obls.length === 0;

      if (p.autoCrearObligacionSiFalta) {
        // J17 (porcentual): materializar el excedente como nueva obligación
        // pagada en el mismo paso. Nunca queda huérfano.
        const extra = await tx.obligacion.create({
          data: {
            organizacionId: p.organizacionId,
            afiliadoId: p.afiliadoId,
            padronId: p.padronId,
            conceptoId: concepto.id,
            periodo: p.periodo,
            origen: 'conciliacion_nomina',
            monto: this.dec(restante),
            saldo: this.dec(0),
            estado: 'pagada',
            bloqueada: false,
            conciliacionEstado: 'descontado',
            conciliacionImporte: this.dec(restante),
            conciliacionFecha: ahora,
          },
          select: { id: true },
        });
        await this.postMovimiento({
          tx,
          organizacionId: p.organizacionId,
          afiliadoId: p.afiliadoId,
          padronId: p.padronId,
          fecha: p.fecha,
          naturaleza: 'credito',
          origen: p.origen,
          concepto: `${p.conceptoLabel} ${p.periodo}`,
          importe: restante,
          obligacionId: extra.id,
          periodoContable: p.periodo,
          pagoId: p.pagoId ?? null,
        });
        stats.obligacionesAplicadas++;
        stats.pagadasTotal++;
      } else {
        // Resto de conceptos (J22/J38/K16): el excedente queda como saldo a
        // favor con bandera de revisión para el operador.
        await this.postMovimiento({
          tx,
          organizacionId: p.organizacionId,
          afiliadoId: p.afiliadoId,
          padronId: p.padronId,
          fecha: p.fecha,
          naturaleza: 'credito',
          origen: p.origen,
          concepto: sinObligacionMatch
            ? `${p.conceptoLabel} (sin obligación matcheada en ${p.periodo})`
            : `${p.conceptoLabel} - excedente ${p.periodo}`,
          importe: restante,
          periodoContable: p.periodo,
          pagoId: p.pagoId ?? null,
          requiereRevision: true,
        });
        stats.excedente = restante;
        if (sinObligacionMatch) stats.sinObligacion = true;
      }
    }

    return stats;
  }

  /**
   * Si el padrón tiene saldo a favor (Padron.saldo < 0), aplica
   * automáticamente parte de ese saldo a una obligación recién creada,
   * generando un crédito con origen='aplicacion_saldo_favor'. Devuelve
   * cuánto se aplicó (0 si no había saldo a favor o la obligación estaba
   * ya saldada).
   *
   * Se invoca desde la materialización mensual después de generar el
   * movimiento débito de cada obligación.
   */
  async aplicarSaldoFavorSiCorresponde(p: {
    tx: Prisma.TransactionClient;
    organizacionId: string;
    afiliadoId: bigint;
    padronId: bigint;
    obligacionId: bigint;
    conceptoLabel: string;
    fecha: Date;
    periodoContable: string;
  }): Promise<{ aplicado: number }> {
    const { tx } = p;

    // Estado actual del padrón (ya bloqueado por el postMovimiento previo en
    // la misma tx, así que es seguro leer sin tomar lock nuevamente).
    const padron = await tx.padron.findUnique({
      where: { id: p.padronId },
      select: { saldo: true },
    });
    const saldoPadron = Number(padron?.saldo ?? 0);
    if (saldoPadron >= -0.009) return { aplicado: 0 };

    const obl = await tx.obligacion.findUnique({
      where: { id: p.obligacionId },
      select: { id: true, saldo: true, conciliacionImporte: true, periodo: true },
    });
    if (!obl) return { aplicado: 0 };
    const saldoObl = Number(obl.saldo);
    if (saldoObl <= 0.009) return { aplicado: 0 };

    // Aplicamos lo mínimo entre |saldo a favor del padrón| y saldo de la obligación.
    const aplica = Math.round(Math.min(Math.abs(saldoPadron), saldoObl) * 100) / 100;
    if (aplica <= 0.009) return { aplicado: 0 };

    const nuevoSaldoObl = Math.round((saldoObl - aplica) * 100) / 100;
    const pagada = nuevoSaldoObl <= 0.009;

    await this.postMovimiento({
      tx,
      organizacionId: p.organizacionId,
      afiliadoId: p.afiliadoId,
      padronId: p.padronId,
      fecha: p.fecha,
      naturaleza: 'credito',
      origen: 'aplicacion_saldo_favor',
      concepto: `Aplicación saldo a favor → ${p.conceptoLabel} ${obl.periodo}`,
      importe: aplica,
      obligacionId: obl.id,
      periodoContable: p.periodoContable,
    });

    const concImp =
      Math.round((Number(obl.conciliacionImporte ?? 0) + aplica) * 100) / 100;
    await tx.obligacion.update({
      where: { id: obl.id },
      data: {
        saldo: nuevoSaldoObl,
        estado: pagada ? 'pagada' : 'parcialmente_pagada',
        conciliacionEstado: pagada ? 'descontado' : 'parcial',
        conciliacionImporte: concImp,
        conciliacionFecha: p.fecha,
      },
    });

    return { aplicado: aplica };
  }

  // ===========================================================================
  // Fase 3 — Administración: recálculo y bandeja de revisión
  // ===========================================================================

  /**
   * Recalcula `Padron.saldo` y `MovimientoAfiliado.saldoPosterior` de todos los
   * padrones del afiliado a partir del ledger (sum debito − sum credito).
   *
   * Es la red de seguridad para reconciliar cuando se sospecha desincronización
   * entre el cache y el ledger. Idempotente: si ya está sincronizado, no hace
   * nada visible.
   *
   * `dryRun=true` no escribe: reporta las diferencias detectadas.
   */
  async recalcularSaldosAfiliado(
    organizacionId: string,
    afiliadoId: bigint,
    dryRun = true,
  ): Promise<{
    afiliadoId: string;
    padrones: Array<{
      padronId: string | null;
      padronLabel: string | null;
      saldoActual: number;
      saldoCalculado: number;
      diferencia: number;
      movimientos: number;
      movimientosActualizados: number;
    }>;
    aplicado: boolean;
  }> {
    return this.prisma.$transaction(
      async (tx) => {
        // Padrones del afiliado (incluye baja).
        const padrones = await tx.padron.findMany({
          where: { organizacionId, afiliadoId },
          select: { id: true, padron: true, saldo: true },
        });

        // Movimientos sin padronId (huérfanos): los contamos aparte como "null".
        const padronesIds = padrones.map((p) => p.id);
        const reporte: Array<{
          padronId: string | null;
          padronLabel: string | null;
          saldoActual: number;
          saldoCalculado: number;
          diferencia: number;
          movimientos: number;
          movimientosActualizados: number;
        }> = [];

        const procesarPadron = async (
          padronId: bigint | null,
          padronLabel: string | null,
          saldoActual: number,
        ) => {
          const movs = await tx.movimientoAfiliado.findMany({
            where: {
              organizacionId,
              afiliadoId,
              padronId: padronId ?? null,
            },
            orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
            select: {
              id: true,
              naturaleza: true,
              importe: true,
              saldoPosterior: true,
            },
          });

          let saldo = 0;
          let actualizados = 0;
          for (const m of movs) {
            const delta = Number(m.importe) * (m.naturaleza === 'credito' ? -1 : 1);
            saldo += delta;
            const saldoRedondeado = Math.round(saldo * 100) / 100;
            const previo = Number(m.saldoPosterior ?? 0);
            if (Math.abs(previo - saldoRedondeado) > 0.009) {
              if (!dryRun) {
                await tx.movimientoAfiliado.update({
                  where: { id: m.id },
                  data: { saldoPosterior: this.dec(saldoRedondeado) },
                });
              }
              actualizados++;
            }
          }

          const saldoCalc = Math.round(saldo * 100) / 100;
          const diferencia = Math.round((saldoCalc - saldoActual) * 100) / 100;

          if (padronId && !dryRun && Math.abs(diferencia) > 0.009) {
            await tx.padron.update({
              where: { id: padronId },
              data: { saldo: this.dec(saldoCalc) },
            });
          }

          reporte.push({
            padronId: padronId?.toString() ?? null,
            padronLabel,
            saldoActual,
            saldoCalculado: saldoCalc,
            diferencia,
            movimientos: movs.length,
            movimientosActualizados: actualizados,
          });
        };

        // Por padrón conocido.
        for (const p of padrones) {
          await procesarPadron(p.id, p.padron, Number(p.saldo ?? 0));
        }

        // Movimientos huérfanos (padronId=null).
        const huerfanosCount = await tx.movimientoAfiliado.count({
          where: { organizacionId, afiliadoId, padronId: null },
        });
        if (huerfanosCount > 0) {
          await procesarPadron(null, null, 0);
        }

        // Actualizar Afiliado.saldo legacy = suma de todos los Padron.saldo
        // (más el saldo huérfano si existe). Esto es transitorio hasta que
        // eliminemos Afiliado.saldo en una fase futura.
        if (!dryRun && padronesIds.length > 0) {
          const padronesActualizados = await tx.padron.findMany({
            where: { id: { in: padronesIds } },
            select: { saldo: true },
          });
          const huerfanoTotal = reporte.find((r) => r.padronId === null)?.saldoCalculado ?? 0;
          const totalGlobal = padronesActualizados.reduce(
            (acc, p) => acc + Number(p.saldo ?? 0),
            huerfanoTotal,
          );
          await tx.afiliado.update({
            where: { id: afiliadoId },
            data: { saldo: this.dec(Math.round(totalGlobal * 100) / 100) },
          });
        }

        return {
          afiliadoId: afiliadoId.toString(),
          padrones: reporte,
          aplicado: !dryRun,
        };
      },
      { timeout: 60_000 },
    );
  }

  /**
   * Recalcula saldos de TODA la organización. Itera por afiliado (chunked) y
   * reusa el método de afiliado. Devuelve un resumen agregado y el detalle
   * de divergencias detectadas.
   *
   * Diseñado para correr fuera de horario pico — puede tardar varios minutos
   * con organizaciones grandes.
   */
  async recalcularSaldosOrganizacion(
    organizacionId: string,
    dryRun = true,
  ): Promise<{
    afiliadosProcesados: number;
    padronesConDiferencia: number;
    movimientosActualizados: number;
    aplicado: boolean;
    divergencias: Array<{
      afiliadoId: string;
      padronId: string | null;
      saldoActual: number;
      saldoCalculado: number;
      diferencia: number;
    }>;
  }> {
    const afiliados = await this.prisma.afiliado.findMany({
      where: { organizacionId },
      select: { id: true },
      orderBy: { id: 'asc' },
    });

    let padronesConDiferencia = 0;
    let movimientosActualizados = 0;
    const divergencias: Array<{
      afiliadoId: string;
      padronId: string | null;
      saldoActual: number;
      saldoCalculado: number;
      diferencia: number;
    }> = [];

    for (const a of afiliados) {
      const r = await this.recalcularSaldosAfiliado(organizacionId, a.id, dryRun);
      for (const p of r.padrones) {
        movimientosActualizados += p.movimientosActualizados;
        if (Math.abs(p.diferencia) > 0.009) {
          padronesConDiferencia++;
          divergencias.push({
            afiliadoId: r.afiliadoId,
            padronId: p.padronId,
            saldoActual: p.saldoActual,
            saldoCalculado: p.saldoCalculado,
            diferencia: p.diferencia,
          });
        }
      }
    }

    return {
      afiliadosProcesados: afiliados.length,
      padronesConDiferencia,
      movimientosActualizados,
      aplicado: !dryRun,
      divergencias,
    };
  }

  /**
   * Lista movimientos pendientes de revisión: créditos huérfanos generados
   * por la conciliación de Cómputos/ANSES cuando no había Obligación que
   * matchear, o cuando la cobranza excedió la deuda del padrón.
   *
   * Devuelve también el contexto que el operador necesita para decidir:
   * datos del afiliado, padrón, monto, período.
   */
  async listarPorRevisar(
    organizacionId: string,
    filtros: { afiliadoId?: bigint; padronId?: bigint; page?: number; pageSize?: number } = {},
  ): Promise<{
    items: Array<{
      id: string;
      fecha: string;
      naturaleza: 'debito' | 'credito';
      origen: string;
      concepto: string;
      importe: number;
      periodoContable: string | null;
      afiliado: { id: string; dni: string | null; apellidoNombre: string };
      padron: { id: string | null; numero: string | null };
      saldoPadronActual: number | null;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Math.max(1, filtros.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, filtros.pageSize ?? 25));

    const where: Prisma.MovimientoAfiliadoWhereInput = {
      organizacionId,
      requiereRevision: true,
      ...(filtros.afiliadoId ? { afiliadoId: filtros.afiliadoId } : {}),
      ...(filtros.padronId ? { padronId: filtros.padronId } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.movimientoAfiliado.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          afiliado: { select: { id: true, dni: true, apellido: true, nombre: true } },
          padron: { select: { id: true, padron: true, saldo: true } },
        },
      }),
      this.prisma.movimientoAfiliado.count({ where }),
    ]);

    const items = rows.map((m) => ({
      id: m.id.toString(),
      fecha: m.fecha.toISOString(),
      naturaleza: m.naturaleza as 'debito' | 'credito',
      origen: m.origen,
      concepto: m.concepto,
      importe: Number(m.importe),
      periodoContable: m.periodoContable,
      afiliado: {
        id: m.afiliado.id.toString(),
        dni: m.afiliado.dni != null ? String(m.afiliado.dni) : null,
        apellidoNombre: `${m.afiliado.apellido ?? ''}${
          m.afiliado.apellido && m.afiliado.nombre ? ', ' : ''
        }${m.afiliado.nombre ?? ''}`.trim(),
      },
      padron: {
        id: m.padron?.id.toString() ?? null,
        numero: m.padron?.padron ?? null,
      },
      saldoPadronActual: m.padron?.saldo != null ? Number(m.padron.saldo) : null,
    }));

    return { items, total, page, pageSize };
  }

  /**
   * Acción: aceptar el crédito huérfano como saldo a favor definitivo.
   * Solo marca `requiereRevision=false`. El saldo del padrón YA refleja el
   * crédito (se aplica al crear el movimiento). Esto sólo lo saca de la
   * bandeja del operador.
   */
  async aceptarComoSaldoFavor(
    organizacionId: string,
    movimientoId: bigint,
  ): Promise<{ ok: true }> {
    await this.prisma.movimientoAfiliado.updateMany({
      where: { id: movimientoId, organizacionId, requiereRevision: true },
      data: { requiereRevision: false },
    });
    return { ok: true };
  }

  /**
   * Acción: vincular manualmente un crédito huérfano a una Obligación
   * específica. Reduce el saldo de la obligación, marca el movimiento
   * como sin revisar y deja traza en `obligacionId`.
   *
   * NOTA: no genera un movimiento nuevo — el crédito ya existe y ya impactó
   * el saldo del padrón. Solo cambia los vínculos lógicos.
   */
  async vincularAObligacion(
    organizacionId: string,
    movimientoId: bigint,
    obligacionId: bigint,
  ): Promise<{ ok: true; obligacionSaldoFinal: number; obligacionEstado: string }> {
    return this.prisma.$transaction(async (tx) => {
      const mov = await tx.movimientoAfiliado.findFirst({
        where: { id: movimientoId, organizacionId, requiereRevision: true },
      });
      if (!mov) {
        throw new BadRequestException('Movimiento no existe o ya no requiere revisión');
      }
      if (mov.naturaleza !== 'credito') {
        throw new BadRequestException('Solo se pueden vincular créditos a obligaciones');
      }

      const obl = await tx.obligacion.findFirst({
        where: { id: obligacionId, organizacionId },
      });
      if (!obl) {
        throw new BadRequestException('Obligación no encontrada');
      }
      if (obl.afiliadoId !== mov.afiliadoId) {
        throw new BadRequestException(
          'La obligación pertenece a otro afiliado',
        );
      }

      const importe = Number(mov.importe);
      const saldoObl = Number(obl.saldo);
      const aplica = Math.min(saldoObl, importe);
      const nuevoSaldo = Math.round((saldoObl - aplica) * 100) / 100;
      const pagada = nuevoSaldo <= 0.009;
      const concImp =
        Math.round((Number(obl.conciliacionImporte ?? 0) + aplica) * 100) / 100;

      await tx.obligacion.update({
        where: { id: obl.id },
        data: {
          saldo: nuevoSaldo,
          estado: pagada ? 'pagada' : 'parcialmente_pagada',
          conciliacionEstado: pagada ? 'descontado' : 'parcial',
          conciliacionImporte: concImp,
          conciliacionFecha: new Date(),
        },
      });

      await tx.movimientoAfiliado.update({
        where: { id: mov.id },
        data: {
          obligacionId: obl.id,
          requiereRevision: false,
        },
      });

      return {
        ok: true,
        obligacionSaldoFinal: nuevoSaldo,
        obligacionEstado: pagada ? 'pagada' : 'parcialmente_pagada',
      };
    });
  }

  /**
   * Acción: anular un movimiento por revisión generando un movimiento
   * inverso (`origen='anulacion'`) que neutraliza su impacto en el saldo.
   * El movimiento original queda con requiereRevision=false (resuelto).
   */
  async anularMovimientoPorRevision(
    organizacionId: string,
    movimientoId: bigint,
    motivo: string,
  ): Promise<{ ok: true; movimientoInversoId: string }> {
    return this.prisma.$transaction(async (tx) => {
      const mov = await tx.movimientoAfiliado.findFirst({
        where: { id: movimientoId, organizacionId, requiereRevision: true },
      });
      if (!mov) {
        throw new BadRequestException('Movimiento no existe o ya no requiere revisión');
      }

      const naturalezaInversa: 'debito' | 'credito' =
        mov.naturaleza === 'credito' ? 'debito' : 'credito';

      const inverso = await this.postMovimiento({
        tx,
        organizacionId,
        afiliadoId: mov.afiliadoId,
        padronId: mov.padronId,
        fecha: new Date(),
        naturaleza: naturalezaInversa,
        origen: 'anulacion',
        concepto: `Anulación: ${mov.concepto} — ${motivo}`,
        importe: Number(mov.importe),
        periodoContable: mov.periodoContable,
      });

      await tx.movimientoAfiliado.update({
        where: { id: mov.id },
        data: { requiereRevision: false },
      });

      return { ok: true, movimientoInversoId: inverso.id.toString() };
    });
  }

  /**
   * Lista la cuenta corriente del afiliado.
   * 
   * REGLAS SIMPLIFICADAS:
   * - Descuentos de nómina: se filtran por periodoContable (el mes al que corresponden)
   * - Pagos de caja: se filtran por fecha física
   * - Órdenes de crédito: se filtran por periodoContable (período de vencimiento de la cuota)
   * - Saldo final: SIEMPRE es el acumulado global (deuda total real)
   */
  async listarCtaCte(
    organizacionId: string,
    afiliadoId: bigint,
    desde?: Date,
    hasta?: Date,
    take = 200,
    padronId?: bigint | null,
    periodoContable?: string | null, // Formato "YYYY-MM"
  ) {
    // Ajustar fechas para incluir todo el día
    let desdeAjustado: Date | undefined;
    let hastaAjustado: Date | undefined;
    
    if (desde) {
      desdeAjustado = new Date(desde);
      desdeAjustado.setHours(0, 0, 0, 0);
    }
    
    if (hasta) {
      hastaAjustado = new Date(hasta);
      hastaAjustado.setHours(23, 59, 59, 999);
    }

    // Construir filtro base
    // Si se especifica padronId, mostrar SOLO movimientos de ese padrón
    const baseWhere: Prisma.MovimientoAfiliadoWhereInput = {
      organizacionId,
      afiliadoId,
      ...(padronId !== undefined && padronId !== null ? { padronId } : {}),
    };

    // Construir condiciones de filtrado por período/fecha
    // Un movimiento se muestra si:
    // 1. Tiene periodoContable = mes seleccionado (descuentos nómina, débitos orden)
    // 2. O tiene fecha física en el mes y NO tiene periodoContable (pagos caja)
    const condiciones: Prisma.MovimientoAfiliadoWhereInput[] = [];
    
    if (periodoContable) {
      // Movimientos con período contable = mes seleccionado
      condiciones.push({ periodoContable });
      
      // Movimientos sin período contable pero con fecha física en el rango
      if (desdeAjustado && hastaAjustado) {
        condiciones.push({
          periodoContable: null,
          fecha: { gte: desdeAjustado, lte: hastaAjustado },
        });
      }
    } else if (desdeAjustado || hastaAjustado) {
      // Sin período contable: filtrar solo por fecha física
      condiciones.push({
        fecha: { 
          ...(desdeAjustado ? { gte: desdeAjustado } : {}), 
          ...(hastaAjustado ? { lte: hastaAjustado } : {}) 
        }
      });
    }

    const where: Prisma.MovimientoAfiliadoWhereInput = {
      ...baseWhere,
      ...(condiciones.length > 0 ? { OR: condiciones } : {}),
    };

    // Buscar movimientos
    const rows = await this.prisma.movimientoAfiliado.findMany({
      where,
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
      take,
    });

    // Obtener IDs para enriquecer con saldos actuales
    const cuotaIds = [...new Set(rows.filter((m) => m.cuotaId).map((m) => m.cuotaId!))];
    const ordenIds = [...new Set(rows.filter((m) => m.ordenId).map((m) => m.ordenId!))];
    const obligacionIds = [
      ...new Set(rows.filter((m) => m.obligacionId).map((m) => m.obligacionId!)),
    ];
    const pagoIds = [...new Set(rows.filter((m) => m.pagoId).map((m) => m.pagoId!))];

    // Consultar saldos actuales
    const cuotas = cuotaIds.length > 0
      ? await this.prisma.ordenCreditoCuota.findMany({
          where: { id: { in: cuotaIds } },
          select: { id: true, saldo: true },
        })
      : [];

    const ordenes = ordenIds.length > 0
      ? await this.prisma.ordenCredito.findMany({
          where: { id: { in: ordenIds } },
          select: { id: true, saldoTotal: true },
        })
      : [];

    const obligaciones =
      obligacionIds.length > 0
        ? await this.prisma.obligacion.findMany({
            where: { id: { in: obligacionIds } },
            select: { id: true, saldo: true },
          })
        : [];

    // Comprobante de recibo asociado al pago (para botón "ver recibo")
    const pagos = pagoIds.length > 0
      ? await this.prisma.pago.findMany({
          where: { id: { in: pagoIds } },
          select: { id: true, comprobanteId: true, numeroRecibo: true },
        })
      : [];

    const mapaCuotas = new Map(cuotas.map((c) => [c.id.toString(), c]));
    const mapaOrdenes = new Map(ordenes.map((o) => [o.id.toString(), o]));
    const mapaObligaciones = new Map(obligaciones.map((o) => [o.id.toString(), o]));
    const mapaPagos = new Map(pagos.map((p) => [p.id.toString(), p]));

    // Enriquecer movimientos con saldo pendiente actual
    const movimientos = rows.map((mov) => {
      let saldoPendiente: number | null = null;

      // Solo mostrar saldo pendiente para débitos vinculados a órdenes/cuotas
      if (mov.naturaleza === 'debito') {
        if (mov.cuotaId) {
          const cuota = mapaCuotas.get(mov.cuotaId.toString());
          if (cuota) saldoPendiente = Number(cuota.saldo || 0);
        } else if (mov.ordenId) {
          const orden = mapaOrdenes.get(mov.ordenId.toString());
          if (orden) saldoPendiente = Number(orden.saldoTotal || 0);
        } else if (mov.obligacionId) {
          const ob = mapaObligaciones.get(mov.obligacionId.toString());
          if (ob) saldoPendiente = Number(ob.saldo || 0);
        }
      }

      const pagoInfo = mov.pagoId ? mapaPagos.get(mov.pagoId.toString()) : null;

      return {
        ...mov,
        saldoPendiente,
        comprobanteId: pagoInfo?.comprobanteId ?? null,
        numeroRecibo: pagoInfo?.numeroRecibo ?? null,
      };
    });

    // SALDO FINAL = deuda total acumulada del padrón = suma(débito) − suma(crédito).
    // Robusto: no depende de saldoPosterior (que no todos los orígenes setean,
    // p. ej. cobranza por nómina u obligaciones sembradas).
    const sumas = await this.prisma.movimientoAfiliado.groupBy({
      by: ['naturaleza'],
      where: baseWhere,
      _sum: { importe: true },
    });
    let totalDebito = 0;
    let totalCredito = 0;
    for (const s of sumas) {
      const v = Number(s._sum.importe || 0);
      if (s.naturaleza === 'debito') totalDebito = v;
      else totalCredito = v;
    }
    const saldoFinal = totalDebito - totalCredito;

    return { movimientos, saldoFinal };
  }

  /**
   * ⚠️ PELIGROSO: Limpia TODOS los movimientos y resetea saldos relacionados.
   * Solo usar en desarrollo/testing.
   */
  async limpiarTodos(organizacionId?: string) {
    return this.prisma.$transaction(
      async (tx) => {
        // 1. Borrar todos los movimientos (opcionalmente filtrado por organización)
        const where = organizacionId ? { organizacionId } : {};
        const deleted = await tx.movimientoAfiliado.deleteMany({ where });

      // 2. Resetear saldos de afiliados
      const afiliadosWhere = organizacionId ? { organizacionId } : {};
      await tx.afiliado.updateMany({
        where: afiliadosWhere,
        data: { saldo: this.dec(0) },
      });

      // 3. Resetear saldos de órdenes de crédito
      const ordenesWhere: any = organizacionId ? { organizacionId } : {};
      const ordenes = await tx.ordenCredito.findMany({
        where: ordenesWhere,
        select: { id: true, importeTotal: true, estado: true },
      });

      let ordenesActualizadas = 0;
      for (const orden of ordenes) {
        // Mantener estado 'anulada' si existe, sino resetear a 'pendiente'
        const nuevoEstado = orden.estado === 'anulada' ? 'anulada' : 'pendiente';
        await tx.ordenCredito.update({
          where: { id: orden.id },
          data: {
            saldoTotal: orden.importeTotal,
            estado: nuevoEstado,
          },
        });
        ordenesActualizadas++;
      }

      // 4. Resetear saldos de cuotas
      const ordenIds = ordenes.map((o) => o.id);
      const cuotas = ordenIds.length > 0
        ? await tx.ordenCreditoCuota.findMany({
            where: {
              ordenId: { in: ordenIds },
            },
            select: { id: true, importe: true, estado: true },
          })
        : [];

      let cuotasActualizadas = 0;
      for (const cuota of cuotas) {
        // Mantener estado 'anulada' si existe, sino resetear a 'pendiente'
        const nuevoEstado = cuota.estado === 'anulada' ? 'anulada' : 'pendiente';
        await tx.ordenCreditoCuota.update({
          where: { id: cuota.id },
          data: {
            saldo: cuota.importe,
            cancelado: this.dec(0),
            estado: nuevoEstado,
          },
        });
        cuotasActualizadas++;
      }

      // 5. Resetear saldos de obligaciones
      const obligacionesWhere: any = organizacionId ? { organizacionId } : {};
      const obligaciones = await tx.obligacion.findMany({
        where: obligacionesWhere,
        select: { id: true, monto: true, estado: true },
      });

      let obligacionesActualizadas = 0;
      for (const obl of obligaciones) {
        // Mantener estado 'anulada' si existe, sino resetear a 'pendiente'
        const nuevoEstado = obl.estado === 'anulada' ? 'anulada' : 'pendiente';
        await tx.obligacion.update({
          where: { id: obl.id },
          data: {
            saldo: obl.monto,
            estado: nuevoEstado,
          },
        });
        obligacionesActualizadas++;
      }

      return {
        mensaje: 'Limpieza completada',
        movimientosBorrados: deleted.count,
        ordenesReseteadas: ordenesActualizadas,
        cuotasReseteadas: cuotasActualizadas,
        obligacionesReseteadas: obligacionesActualizadas,
      };
      },
      { maxWait: 120000, timeout: 120000 } // 2 minutos de timeout
    );
  }

  /**
   * Reversa simple: genera un movimiento inverso (y asiento inverso si corresponde).
   */
  async reversar(id: bigint, motivo = 'Reversión') {
    const original = await this.prisma.movimientoAfiliado.findUnique({ where: { id } });
    if (!original) throw new BadRequestException('Movimiento inexistente');

    return this.postMovimiento({
      organizacionId: original.organizacionId,
      afiliadoId: original.afiliadoId,
      padronId: original.padronId ?? undefined,
      naturaleza: original.naturaleza === 'debito' ? 'credito' : 'debito',
      origen: 'anulacion',
      concepto: motivo,
      importe: Number(original.importe), // ARS
      moneda: (original as any).moneda ?? undefined,
      importeMoneda: (original as any).importeMoneda ?? undefined,
      tcAplicado: (original as any).tcAplicado ?? undefined,

      obligacionId: original.obligacionId ?? undefined,
      ordenId: original.ordenId ?? undefined,
      cuotaId: original.cuotaId ?? undefined,
      pagoId: original.pagoId ?? undefined,

      asiento: original.asientoId
        ? {
            descripcion: `Reversa de asiento ${original.asientoId.toString()}`,
            referenciaId: original.asientoId.toString(),
            // moneda: (original as any).moneda ?? null,
            // tc: (original as any).tcAplicado ?? null,
          }
        : undefined,
    });
  }
}
