/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';
import { NovedadesPendientesService } from './novedades-pendientes.service';
import {
  armarLinea,
  clasificarTipo,
  nombreArchivo,
  type BloqueNovedad,
  type CodigoNovedad,
} from './novedades-formato';

const PERIODO_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const CONCEPTOS_CODIGO = {
  J17: 'CUOTA_SOC',
  J22: 'COSEGURO',
  J38: 'ADIC_COL',
  K16: 'ORDEN_CREDITO',
} as const;

type Canal = 'ESC' | 'ANSES';

/** Mapeo canal → destino de NovedadPendiente. */
const CANAL_A_DESTINO: Record<Canal, 'COMPUTOS' | 'ANSES'> = {
  ESC: 'COMPUTOS',
  ANSES: 'ANSES',
};

@Injectable()
export class NovedadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pendientes: NovedadesPendientesService,
  ) {}

  // =====================================================================
  // GENERAR BORRADOR
  // =====================================================================

  /**
   * Arma (o regenera) el borrador del período objetivo para el canal indicado.
   *
   * Modelo operator-driven:
   *   - Lee NovedadPendiente(estado='pendiente', periodoObjetivo=periodo,
   *     destino=mapeo(canal)) — son las altas/bajas/modificaciones J17/J22/J38
   *     cargadas durante el mes vía hooks o manualmente desde el panel.
   *   - Suma K16 calculado: obligaciones con período <= período del lote.
   *   - Combina ambos en una línea por padrón.
   *
   * Regenerable: si ya existe un borrador del período/canal, borra sus items y
   * vuelve a generar dentro del mismo lote (preserva el id).
   *
   * NO bloquea obligaciones ni marca pendientes como enviadas (eso lo hace
   * `marcarEnviado`).
   */
  async generarBorrador(opts: {
    organizacionId: string;
    periodo: string;
    canal?: Canal;
    usuarioId?: string;
  }) {
    const { organizacionId, periodo, canal = 'ESC', usuarioId } = opts;
    if (!PERIODO_REGEX.test(periodo)) {
      throw new BadRequestException(`Periodo inválido: ${periodo} (esperado YYYY-MM)`);
    }

    // Reusar borrador existente del mismo período/canal si está abierto.
    // Si está enviado/conciliado/parcial → no se puede regenerar.
    const loteExistente = await this.prisma.novedadLote.findFirst({
      where: { organizacionId, periodo, canal, estado: { not: 'anulado' } },
      orderBy: { generadoEn: 'desc' },
      select: { id: true, estado: true },
    });
    if (loteExistente && loteExistente.estado !== 'borrador') {
      throw new BadRequestException(
        `El lote del período ${periodo} ya está en estado "${loteExistente.estado}", no se puede regenerar.`,
      );
    }

    // Cargar conceptos necesarios.
    const conceptos = await this.prisma.concepto.findMany({
      where: {
        organizacionId,
        codigo: { in: Object.values(CONCEPTOS_CODIGO) },
      },
      select: { id: true, codigo: true },
    });
    const conceptoIdByCodigo = new Map<string, bigint>();
    for (const c of conceptos) conceptoIdByCodigo.set(c.codigo, c.id);

    // 1) Novedades pendientes operator-driven (J17/J22/J38) del período.
    const destino = CANAL_A_DESTINO[canal];
    const pendientesRaw = await this.prisma.novedadPendiente.findMany({
      where: {
        organizacionId,
        estado: 'pendiente',
        periodoObjetivo: periodo,
        destino,
      },
      include: {
        padron: {
          select: {
            id: true,
            padron: true,
            centro: true,
            activo: true,
            sistema: true,
          },
        },
      },
    });

    type PendienteRow = (typeof pendientesRaw)[number];
    const pendByPadron = new Map<string, PendienteRow[]>();
    for (const p of pendientesRaw) {
      const k = p.padronId.toString();
      const arr = pendByPadron.get(k) ?? [];
      arr.push(p);
      pendByPadron.set(k, arr);
    }

    // Bajas estructurales (PADRON_COMPLETO) pendientes en BajaInformable.
    // Las bajas J17/J22/J38 puntuales ahora se modelan como NovedadPendiente.
    const bajasPadronCompleto = await this.prisma.bajaInformable.findMany({
      where: {
        organizacionId,
        estado: 'pendiente',
        codigo: 'PADRON_COMPLETO',
      },
    });
    const bajasPadronCompletoByPadron = new Map<string, (typeof bajasPadronCompleto)[number]>();
    for (const b of bajasPadronCompleto) {
      bajasPadronCompletoByPadron.set(b.padronId.toString(), b);
    }

    // Obligaciones K16 abiertas (saldo > 0, no bloqueadas).
    let obligacionesK16: Array<{
      id: bigint;
      padronId: bigint | null;
      afiliadoId: bigint;
      periodo: string;
      saldo: number;
    }> = [];
    const conceptoK16Id = conceptoIdByCodigo.get(CONCEPTOS_CODIGO.K16);
    if (conceptoK16Id) {
      // Sólo se envían las cuotas con periodo <= período del lote:
      //   - periodo == lote → componente "cuota_mes" (lo que toca este mes).
      //   - periodo  < lote → componente "saldo_arrastrado" (no se cobró antes).
      // Las cuotas de meses futuros (periodo > lote) se dejan para su mes;
      // no se anticipan en este envío.
      const obls = await this.prisma.obligacion.findMany({
        where: {
          organizacionId,
          conceptoId: conceptoK16Id,
          bloqueada: false,
          estado: { in: ['pendiente', 'parcialmente_pagada'] },
          saldo: { gt: 0 },
          periodo: { lte: periodo },
        },
        select: {
          id: true,
          padronId: true,
          afiliadoId: true,
          periodo: true,
          saldo: true,
        },
        orderBy: { periodo: 'asc' },
      });
      obligacionesK16 = obls.map((o) => ({
        id: o.id,
        padronId: o.padronId,
        afiliadoId: o.afiliadoId,
        periodo: o.periodo,
        saldo: Number(o.saldo),
      }));
    }
    const k16ByPadron = new Map<string, typeof obligacionesK16>();
    for (const o of obligacionesK16) {
      if (o.padronId == null) continue;
      const k = o.padronId.toString();
      const arr = k16ByPadron.get(k) ?? [];
      arr.push(o);
      k16ByPadron.set(k, arr);
    }

    // Lote: reusar borrador existente o crear uno nuevo.
    let lote;
    if (loteExistente) {
      // Limpiar items + detalles + obligaciones del borrador anterior.
      await this.prisma.$transaction([
        this.prisma.novedadK16Detalle.deleteMany({
          where: { loteItem: { loteId: loteExistente.id } },
        }),
        this.prisma.novedadLoteObligacion.deleteMany({ where: { loteId: loteExistente.id } }),
        this.prisma.novedadLoteItem.deleteMany({ where: { loteId: loteExistente.id } }),
        this.prisma.novedadLote.update({
          where: { id: loteExistente.id },
          data: {
            generadoEn: new Date(),
            generadoPorId: usuarioId ?? null,
            archivoContenido: null,
            archivoHash: null,
            totalLineas: 0,
            totalAfiliados: 0,
            totalJ22: 0,
            totalJ38: 0,
            totalK16: 0,
            totalJ17Altas: 0,
            totalJ17Bajas: 0,
          },
        }),
      ]);
      lote = await this.prisma.novedadLote.findUniqueOrThrow({
        where: { id: loteExistente.id },
      });
    } else {
      lote = await this.prisma.novedadLote.create({
        data: {
          organizacionId,
          periodo,
          canal,
          estado: 'borrador',
          generadoPorId: usuarioId ?? null,
          archivoNombre: nombreArchivo(periodo, canal),
        },
      });
    }

    // Construir items combinando: padrones con pendientes + padrones con K16 +
    // padrones con baja PADRON_COMPLETO.
    type ItemBuilder = {
      padronId: bigint;
      afiliadoId: bigint;
      centro: number | null;
      padron: string;
      bloques: BloqueNovedad[];
      k16Detalle: Array<{
        obligacionId: bigint;
        componente: 'cuota_mes' | 'saldo_arrastrado';
        monto: number;
        periodoOrigen: string;
      }>;
      obligacionesIncluidasIds: bigint[];
    };

    const builderByPadron = new Map<string, ItemBuilder>();

    // Helper: cargar/crear el builder de un padrón (lookup en BD si hace falta).
    const ensureBuilder = async (padronId: bigint): Promise<ItemBuilder> => {
      const k = padronId.toString();
      const existing = builderByPadron.get(k);
      if (existing) return existing;
      const p = await this.prisma.padron.findUniqueOrThrow({
        where: { id: padronId },
        select: { id: true, padron: true, centro: true, afiliadoId: true },
      });
      const b: ItemBuilder = {
        padronId: p.id,
        afiliadoId: p.afiliadoId,
        centro: p.centro ?? null,
        padron: p.padron,
        bloques: [],
        k16Detalle: [],
        obligacionesIncluidasIds: [],
      };
      builderByPadron.set(k, b);
      return b;
    };

    // 1) Bloques desde NovedadPendiente (J17/J22/J38).
    for (const [padronKey, lista] of pendByPadron.entries()) {
      const b = await ensureBuilder(BigInt(padronKey));
      // Para cada concepto, tomar la última pendiente cargada (idempotencia ya
      // garantiza una por padrón+concepto+periodo).
      const porConcepto = new Map<string, PendienteRow>();
      for (const p of lista) porConcepto.set(p.concepto, p);
      for (const codigo of ['J17', 'J22', 'J38'] as const) {
        const p = porConcepto.get(codigo);
        if (!p) continue;
        const monto = p.tipoMovimiento === 'baja' ? 0 : Number(p.valor ?? 0);
        b.bloques.push({ codigo, monto });
      }
    }

    // 2) Baja completa del padrón (PADRON_COMPLETO): emitir J17/J22/J38/K16 = 0.
    const bajasUsadasIds: bigint[] = [];
    for (const [padronKey, baja] of bajasPadronCompletoByPadron.entries()) {
      const b = await ensureBuilder(BigInt(padronKey));
      const existentes = new Set(b.bloques.map((bl) => bl.codigo));
      for (const codigo of ['J17', 'J22', 'J38', 'K16'] as const) {
        if (!existentes.has(codigo)) b.bloques.push({ codigo, monto: 0 });
      }
      bajasUsadasIds.push(baja.id);
    }

    // 3) Bloques desde K16 calculado.
    for (const [padronKey, k16Obls] of k16ByPadron.entries()) {
      const b = await ensureBuilder(BigInt(padronKey));
      // Si ya hay un bloque K16 (vino de la baja PADRON_COMPLETO), no lo pisamos.
      if (b.bloques.find((bl) => bl.codigo === 'K16')) continue;

      let k16Total = 0;
      for (const o of k16Obls) {
        const componente: 'cuota_mes' | 'saldo_arrastrado' =
          o.periodo === periodo ? 'cuota_mes' : 'saldo_arrastrado';
        b.k16Detalle.push({
          obligacionId: o.id,
          componente,
          monto: o.saldo,
          periodoOrigen: o.periodo,
        });
        b.obligacionesIncluidasIds.push(o.id);
        k16Total += o.saldo;
      }
      if (k16Total > 0) {
        b.bloques.push({ codigo: 'K16', monto: k16Total });
      }
    }

    const items: ItemBuilder[] = Array.from(builderByPadron.values()).filter(
      (b) => b.bloques.length > 0,
    );

    // Persistir items + k16 detalles + obligaciones bloqueadas (estructura).
    const linesText: string[] = [];
    let totalJ22 = 0;
    let totalJ38 = 0;
    let totalK16 = 0;
    let totalJ17Altas = 0;
    let totalJ17Bajas = 0;

    for (const it of items) {
      const linea = armarLinea({
        centro: it.centro,
        padron: it.padron,
        bloques: it.bloques,
      });
      linesText.push(linea);

      for (const b of it.bloques) {
        if (b.codigo === 'J17') {
          if (b.monto > 0) totalJ17Altas++;
          else totalJ17Bajas++;
        }
        if (b.codigo === 'J22' && b.monto > 0) totalJ22 += b.monto;
        if (b.codigo === 'J38' && b.monto > 0) totalJ38 += b.monto;
        if (b.codigo === 'K16' && b.monto > 0) totalK16 += b.monto;
      }

      const tipoMovimiento = clasificarTipo(it.bloques);
      const dictBloques: Partial<Record<CodigoNovedad, number>> = {};
      for (const b of it.bloques) dictBloques[b.codigo] = b.monto;

      const itemCreado = await this.prisma.novedadLoteItem.create({
        data: {
          loteId: lote.id,
          padronId: it.padronId,
          afiliadoId: it.afiliadoId,
          centroSnapshot: it.centro,
          padronSnapshot: it.padron,
          lineaCompleta: linea,
          tipoMovimiento,
          valorJ17: dictBloques.J17 ?? null,
          valorJ22: dictBloques.J22 ?? null,
          valorJ38: dictBloques.J38 ?? null,
          valorK16: dictBloques.K16 ?? null,
        },
      });

      if (it.k16Detalle.length > 0) {
        await this.prisma.novedadK16Detalle.createMany({
          data: it.k16Detalle.map((d) => ({
            loteItemId: itemCreado.id,
            obligacionId: d.obligacionId,
            componente: d.componente,
            monto: d.monto,
            periodoOrigen: d.periodoOrigen,
          })),
        });
      }

      if (it.obligacionesIncluidasIds.length > 0) {
        await this.prisma.novedadLoteObligacion.createMany({
          data: it.obligacionesIncluidasIds.map((oid) => ({
            loteId: lote.id,
            obligacionId: oid,
          })),
          skipDuplicates: true,
        });
      }
    }

    const archivoContenido = linesText.join('\r\n') + (linesText.length > 0 ? '\r\n' : '');
    const archivoHash = crypto.createHash('sha256').update(archivoContenido).digest('hex');

    await this.prisma.novedadLote.update({
      where: { id: lote.id },
      data: {
        archivoContenido,
        archivoHash,
        totalLineas: items.length,
        totalAfiliados: new Set(items.map((i) => i.afiliadoId.toString())).size,
        totalJ22,
        totalJ38,
        totalK16,
        totalJ17Altas,
        totalJ17Bajas,
      },
    });

    await this.audit.log({
      organizacionId,
      usuarioId,
      accion: 'NOVEDADES_GENERAR_BORRADOR',
      entidad: 'NovedadLote',
      entidadId: lote.id.toString(),
      metadata: {
        periodo,
        canal,
        totalLineas: items.length,
        totalAfiliados: new Set(items.map((i) => i.afiliadoId.toString())).size,
      },
    });

    return this.detalle(organizacionId, lote.id);
  }

  // =====================================================================
  // MARCAR ENVIADO / ANULAR / LISTAR / DETALLE
  // =====================================================================

  /** Marca un borrador como enviado: bloquea obligaciones y bajas. */
  async marcarEnviado(
    organizacionId: string,
    loteId: bigint,
    usuarioId?: string,
  ) {
    const lote = await this.prisma.novedadLote.findFirst({
      where: { organizacionId, id: loteId },
      include: { obligacionesBloqueadas: true },
    });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    if (lote.estado !== 'borrador') {
      throw new BadRequestException(`El lote está en estado ${lote.estado}, no se puede enviar`);
    }

    const canal = lote.canal as Canal;
    const destino = CANAL_A_DESTINO[canal] ?? 'COMPUTOS';
    const padronesEnLote = await this.padronesDelLote(lote.id);

    await this.prisma.$transaction([
      this.prisma.novedadLote.update({
        where: { id: lote.id },
        data: {
          estado: 'enviado',
          enviadoEn: new Date(),
          enviadoPorId: usuarioId ?? null,
        },
      }),
      this.prisma.obligacion.updateMany({
        where: { id: { in: lote.obligacionesBloqueadas.map((o) => o.obligacionId) } },
        data: { bloqueada: true },
      }),
      // BajaInformable PADRON_COMPLETO incluida en el lote → informada.
      this.prisma.bajaInformable.updateMany({
        where: {
          organizacionId,
          estado: 'pendiente',
          codigo: 'PADRON_COMPLETO',
          padronId: { in: padronesEnLote },
        },
        data: {
          estado: 'informada',
          loteEnvioId: lote.id,
          fechaInformada: new Date(),
        },
      }),
      // NovedadPendiente del período/destino → enviada con loteId.
      this.prisma.novedadPendiente.updateMany({
        where: {
          organizacionId,
          estado: 'pendiente',
          periodoObjetivo: lote.periodo,
          destino,
          padronId: { in: padronesEnLote },
        },
        data: {
          estado: 'enviada',
          loteId: lote.id,
          enviadaEn: new Date(),
        },
      }),
    ]);

    await this.audit.log({
      organizacionId,
      usuarioId,
      accion: 'NOVEDADES_MARCAR_ENVIADO',
      entidad: 'NovedadLote',
      entidadId: lote.id.toString(),
    });

    return this.detalle(organizacionId, lote.id);
  }

  private async padronesDelLote(loteId: bigint): Promise<bigint[]> {
    const items = await this.prisma.novedadLoteItem.findMany({
      where: { loteId },
      select: { padronId: true },
    });
    return items.map((i) => i.padronId);
  }

  /** Anula un lote (borrador o enviado). Desbloquea obligaciones y revierte bajas. */
  async anular(
    organizacionId: string,
    loteId: bigint,
    motivo: string,
    usuarioId?: string,
  ) {
    const lote = await this.prisma.novedadLote.findFirst({
      where: { organizacionId, id: loteId },
      include: { obligacionesBloqueadas: true },
    });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    if (lote.estado === 'anulado') {
      return this.detalle(organizacionId, lote.id);
    }
    if (lote.estado === 'conciliado') {
      throw new ForbiddenException('No se puede anular un lote ya conciliado');
    }

    await this.prisma.$transaction([
      this.prisma.novedadLote.update({
        where: { id: lote.id },
        data: {
          estado: 'anulado',
          anuladoEn: new Date(),
          anuladoPorId: usuarioId ?? null,
          motivoAnulacion: motivo,
        },
      }),
      // Desbloquear obligaciones referenciadas
      this.prisma.obligacion.updateMany({
        where: { id: { in: lote.obligacionesBloqueadas.map((o) => o.obligacionId) } },
        data: { bloqueada: false },
      }),
      this.prisma.novedadLoteObligacion.updateMany({
        where: { loteId: lote.id },
        data: { desbloqueadaEn: new Date() },
      }),
      // Revertir bajas informadas: vuelven a pendiente
      this.prisma.bajaInformable.updateMany({
        where: { loteEnvioId: lote.id, estado: 'informada' },
        data: {
          estado: 'pendiente',
          loteEnvioId: null,
          fechaInformada: null,
        },
      }),
      // Revertir NovedadPendiente enviadas en este lote: vuelven a pendiente
      this.prisma.novedadPendiente.updateMany({
        where: { loteId: lote.id, estado: 'enviada' },
        data: {
          estado: 'pendiente',
          loteId: null,
          enviadaEn: null,
        },
      }),
    ]);

    await this.audit.log({
      organizacionId,
      usuarioId,
      accion: 'NOVEDADES_ANULAR_LOTE',
      entidad: 'NovedadLote',
      entidadId: lote.id.toString(),
      metadata: { motivo, estadoPrevio: lote.estado },
    });

    return this.detalle(organizacionId, lote.id);
  }

  /** Lista lotes con orden cronológico descendente. */
  async listar(organizacionId: string, limit = 20) {
    const items = await this.prisma.novedadLote.findMany({
      where: { organizacionId },
      orderBy: { generadoEn: 'desc' },
      take: limit,
    });
    return items.map(serializeLote);
  }

  /** Detalle de un lote (cabecera + counts). */
  async detalle(organizacionId: string, loteId: bigint) {
    const lote = await this.prisma.novedadLote.findFirst({
      where: { organizacionId, id: loteId },
      include: {
        _count: { select: { items: true, obligacionesBloqueadas: true, bajasInformadas: true } },
      },
    });
    if (!lote) throw new NotFoundException('Lote no encontrado');
    return {
      ...serializeLote(lote),
      counts: {
        items: lote._count.items,
        obligacionesBloqueadas: lote._count.obligacionesBloqueadas,
        bajasInformadas: lote._count.bajasInformadas,
      },
    };
  }

  /** Items del lote con info de afiliado y padrón. */
  async items(organizacionId: string, loteId: bigint) {
    const lote = await this.prisma.novedadLote.findFirst({
      where: { organizacionId, id: loteId },
      select: { id: true },
    });
    if (!lote) throw new NotFoundException('Lote no encontrado');

    const items = await this.prisma.novedadLoteItem.findMany({
      where: { loteId: lote.id },
      include: {
        afiliado: { select: { id: true, dni: true, apellido: true, nombre: true } },
        k16Detalle: true,
      },
      orderBy: { id: 'asc' },
    });
    return items.map((i) => ({
      id: i.id.toString(),
      padronId: i.padronId.toString(),
      afiliadoId: i.afiliadoId.toString(),
      centro: i.centroSnapshot,
      padron: i.padronSnapshot,
      tipoMovimiento: i.tipoMovimiento,
      lineaCompleta: i.lineaCompleta,
      valorJ17: i.valorJ17 == null ? null : Number(i.valorJ17),
      valorJ22: i.valorJ22 == null ? null : Number(i.valorJ22),
      valorJ38: i.valorJ38 == null ? null : Number(i.valorJ38),
      valorK16: i.valorK16 == null ? null : Number(i.valorK16),
      afiliado: {
        ...i.afiliado,
        id: i.afiliado.id.toString(),
        dni: i.afiliado.dni.toString(),
      },
      k16Detalle: i.k16Detalle.map((d) => ({
        obligacionId: d.obligacionId.toString(),
        componente: d.componente,
        monto: Number(d.monto),
        periodoOrigen: d.periodoOrigen,
      })),
    }));
  }

  /** Devuelve el contenido del .txt como string para descarga. */
  async getArchivo(organizacionId: string, loteId: bigint) {
    const lote = await this.prisma.novedadLote.findFirst({
      where: { organizacionId, id: loteId },
      select: { archivoContenido: true, archivoNombre: true },
    });
    if (!lote || !lote.archivoContenido) {
      throw new NotFoundException('Lote sin archivo');
    }
    return {
      contenido: lote.archivoContenido,
      nombre: lote.archivoNombre ?? 'novedades.txt',
    };
  }

  // =====================================================================
  // BAJAS INFORMABLES (helper compartido con otros módulos)
  // =====================================================================

  /** Crea una baja informable. Si ya hay una pendiente para mismo (padrón, código), no duplica. */
  async crearBajaInformable(input: {
    organizacionId: string;
    padronId: bigint;
    codigo: 'PADRON_COMPLETO' | 'J17' | 'J22' | 'J38' | 'K16';
    motivo: string;
    observacion?: string;
    solicitadoPorId?: string | null;
  }) {
    const existente = await this.prisma.bajaInformable.findFirst({
      where: {
        organizacionId: input.organizacionId,
        padronId: input.padronId,
        codigo: input.codigo,
        estado: 'pendiente',
      },
      select: { id: true },
    });
    if (existente) return existente;

    return this.prisma.bajaInformable.create({
      data: {
        organizacionId: input.organizacionId,
        padronId: input.padronId,
        codigo: input.codigo,
        motivo: input.motivo,
        observacion: input.observacion,
        solicitadoPorId: input.solicitadoPorId ?? null,
      },
    });
  }

  /** Cancela una baja pendiente. */
  async cancelarBaja(
    organizacionId: string,
    bajaId: bigint,
    motivo: string,
    usuarioId?: string,
  ) {
    const baja = await this.prisma.bajaInformable.findFirst({
      where: { organizacionId, id: bajaId, estado: 'pendiente' },
    });
    if (!baja) throw new NotFoundException('Baja no encontrada o no pendiente');
    await this.prisma.bajaInformable.update({
      where: { id: baja.id },
      data: {
        estado: 'cancelada',
        fechaCancelada: new Date(),
        canceladaPorId: usuarioId ?? null,
        motivoCancelacion: motivo,
      },
    });
    await this.audit.log({
      organizacionId,
      usuarioId,
      accion: 'BAJA_INFORMABLE_CANCELAR',
      entidad: 'BajaInformable',
      entidadId: baja.id.toString(),
      metadata: { motivo },
    });
    return { ok: true };
  }

  async listarBajasPendientes(organizacionId: string) {
    const items = await this.prisma.bajaInformable.findMany({
      where: { organizacionId, estado: 'pendiente' },
      include: {
        padron: {
          select: {
            id: true,
            padron: true,
            centro: true,
            afiliado: { select: { id: true, dni: true, apellido: true, nombre: true } },
          },
        },
      },
      orderBy: { fechaSolicitada: 'desc' },
    });
    return items.map((b) => ({
      id: b.id.toString(),
      padronId: b.padronId.toString(),
      codigo: b.codigo,
      motivo: b.motivo,
      observacion: b.observacion,
      fechaSolicitada: b.fechaSolicitada,
      solicitadoPorId: b.solicitadoPorId,
      padron: {
        id: b.padron.id.toString(),
        padron: b.padron.padron,
        centro: b.padron.centro,
        afiliado: b.padron.afiliado
          ? {
              ...b.padron.afiliado,
              id: b.padron.afiliado.id.toString(),
              dni: b.padron.afiliado.dni.toString(),
            }
          : null,
      },
    }));
  }
}

function serializeLote(l: any) {
  return {
    id: l.id.toString(),
    organizacionId: l.organizacionId,
    periodo: l.periodo,
    canal: l.canal,
    estado: l.estado,
    generadoEn: l.generadoEn,
    generadoPorId: l.generadoPorId,
    enviadoEn: l.enviadoEn,
    enviadoPorId: l.enviadoPorId,
    conciliadoEn: l.conciliadoEn,
    anuladoEn: l.anuladoEn,
    motivoAnulacion: l.motivoAnulacion,
    archivoNombre: l.archivoNombre,
    archivoHash: l.archivoHash,
    totalLineas: l.totalLineas,
    totalAfiliados: l.totalAfiliados,
    totalJ22: Number(l.totalJ22),
    totalJ38: Number(l.totalJ38),
    totalK16: Number(l.totalK16),
    totalJ17Altas: l.totalJ17Altas,
    totalJ17Bajas: l.totalJ17Bajas,
  };
}
