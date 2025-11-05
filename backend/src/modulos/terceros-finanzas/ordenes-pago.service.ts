/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
// src/modulos/terceros-finanzas/ordenes-pago.service.ts
import { Injectable } from '@nestjs/common';
import {
  PrismaClient,
  Prisma,
  RolTercero,
  MetodoPagoOP,
  ComprobanteFormato,
  ComprobanteEstado,
  EstadoOrdenPago,
} from '@prisma/client';
import { CuentasService } from './cuentas.service';
import { D } from './money';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
import { ImpresionService, ImprimirComprobanteDto } from '../impresion/impresion.service';

import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Numeración pública/visible para OP (misma para cabecera y comprobante)
const SERIE_OP = 'OP';
const PTOVTA_OP = 0;

// Runtime-safe lista de valores válidos para MetodoPagoOP
const METODO_PAGO_OP_VALUES = ['transferencia', 'cheque', 'efectivo', 'otro'] as const;
type MetodoPagoOPValue = (typeof METODO_PAGO_OP_VALUES)[number];

function isMetodoPagoOP(x: string): x is MetodoPagoOPValue {
  return (METODO_PAGO_OP_VALUES as readonly string[]).includes(x as MetodoPagoOPValue);
}

@Injectable()
export class OrdenesPagoService {
  constructor(
    private cuentas: CuentasService,
    private contab: ContabilidadService,
    private impresion: ImpresionService,
  ) {}

  /* ===================== Helpers ===================== */

  private async savePdf(buffer: Buffer, filename: string) {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const dir = path.join(process.cwd(), 'storage', 'comprobantes');
    await fs.mkdir(dir, { recursive: true });
    const full = path.join(dir, filename);
    await fs.writeFile(full, buffer);
    return { storageKey: `file://${full}`, hash };
  }

  private fmtAfip(pv?: number | null, nro?: number | null) {
    const a = String(pv ?? 0).padStart(4, '0');
    const b = String(nro ?? 0).padStart(8, '0');
    return `${a}-${b}`;
  }

  private resolveTemplatePersist(
    tipo: 'ORDEN_PAGO' | 'RECIBO_AFILIADO' | 'REINTEGRO_AFILIADO',
    formato: 'A4' | 'A5' | 'TICKET_80MM',
  ) {
    const base = tipo.toLowerCase();
    const template = formato === 'TICKET_80MM' ? `${base}.ticket.njk` : `${base}.a4.njk`;
    const css = formato === 'TICKET_80MM' ? 'ticket-80mm.css' : 'a4.css';
    return { template, css };
  }

  private async buildItemsDesdeAplicaciones(
    tx: Prisma.TransactionClient,
    apps: { comprobanteId: string | number | bigint; montoAplicado: number | string }[],
  ) {
    if (!apps?.length)
      return [] as Array<{
        desc: string;
        cantidad: number;
        pUnit: number;
        importe: number;
        orden: number;
      }>;

    const ids = apps.map((a) => BigInt(String(a.comprobanteId)));
    const comps = await tx.comprobanteTercero.findMany({
      where: { id: { in: ids } },
      select: { id: true, tipo: true, clase: true, puntoVenta: true, numero: true, fecha: true },
    });

    const byId = new Map(comps.map((c) => [c.id.toString(), c]));

    return apps.map((a, idx) => {
      const key = BigInt(String(a.comprobanteId)).toString();
      const c = byId.get(key);
      const etiqueta = c
        ? `${c.tipo}${c.clase ? ' ' + c.clase : ''} ${this.fmtAfip(c.puntoVenta, c.numero)} (${c.fecha.toLocaleDateString('es-AR')})`
        : `Comprobante ${a.comprobanteId}`;
      const monto = Number(a.montoAplicado);
      return { desc: etiqueta, cantidad: 1, pUnit: monto, importe: monto, orden: idx + 1 };
    });
  }

  /** Normaliza el método recibido (string/enum) al literal EXACTO del enum runtime */
  private toMetodoEnum(v: MetodoPagoOP | string): MetodoPagoOP {
    const s = String(v).trim().toLowerCase();
    if (isMetodoPagoOP(s)) return s as MetodoPagoOP;
    throw new Error(
      `MetodoPagoOP inválido: "${v}". Valores válidos: ${METODO_PAGO_OP_VALUES.join(', ')}`,
    );
  }

  /** Reserva número con inicialización = max(OP.numeroOP, Comprobante.numero) */
  private async reservarNumeroOP(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    longitud = 8,
  ) {
    const tipo = 'ORDEN_PAGO' as const;

    // Reintenta si dos transacciones crean el numerador a la vez
    for (let i = 0; i < 3; i++) {
      const exist = await tx.numerador.findUnique({
        where: {
          organizacionId_tipo_ptoVta_serie: {
            organizacionId,
            tipo,
            ptoVta: PTOVTA_OP,
            serie: SERIE_OP,
          },
        },
        select: { longitud: true },
      });

      if (exist) {
        const upd = await tx.numerador.update({
          where: {
            organizacionId_tipo_ptoVta_serie: {
              organizacionId,
              tipo,
              ptoVta: PTOVTA_OP,
              serie: SERIE_OP,
            },
          },
          data: { ultimoNumero: { increment: 1 } },
          select: { ultimoNumero: true, longitud: true },
        });
        const numero = upd.ultimoNumero;
        const numeroFormateado = String(numero).padStart(upd.longitud ?? longitud, '0');
        return { numero, numeroFormateado };
      }

      // No existe → inicializo con el máximo histórico + 1 (OP o Comprobante)
      const [aggOP, aggComp] = await Promise.all([
        tx.ordenPagoTercero.aggregate({
          where: { organizacionId },
          _max: { numeroOP: true },
        }),
        tx.comprobante.aggregate({
          where: { organizacionId, tipo, ptoVta: PTOVTA_OP, serie: SERIE_OP },
          _max: { numero: true },
        }),
      ]);
      const start = Math.max(aggOP._max.numeroOP ?? 0, aggComp._max.numero ?? 0) + 1;

      try {
        const created = await tx.numerador.create({
          data: {
            organizacionId,
            tipo,
            ptoVta: PTOVTA_OP,
            serie: SERIE_OP,
            ultimoNumero: start,
            longitud,
          },
          select: { ultimoNumero: true, longitud: true },
        });
        const numero = created.ultimoNumero;
        const numeroFormateado = String(numero).padStart(created.longitud ?? longitud, '0');
        return { numero, numeroFormateado };
      } catch (e: unknown) {
        // choque de unique → retry
        if ((e as { code?: string })?.code !== 'P2002') throw e;
      }
    }
    throw new Error('No se pudo reservar número de OP (colisiones repetidas).');
  }

  /* ===================== Crear OP ===================== */

  async crear(dto: {
    organizacionId: string;
    terceroId: string | number | bigint;
    rol: RolTercero;
    fecha?: string | Date | null;
    observaciones?: string | null;
    metodos: { metodo: MetodoPagoOP | string; monto: number | string; ref?: string | null }[];
    aplicaciones: { comprobanteId: string | number | bigint; montoAplicado: number | string }[];
  }) {
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

    const totalMetodos = dto.metodos.reduce(
      (acc, m) => acc.add(new Prisma.Decimal(m.monto)),
      new Prisma.Decimal(0),
    );
    const totalAplic = dto.aplicaciones.reduce(
      (acc, a) => acc.add(new Prisma.Decimal(a.montoAplicado)),
      new Prisma.Decimal(0),
    );
    if (!totalMetodos.equals(totalAplic)) {
      throw new Error('El total de métodos debe igualar el total aplicado.');
    }

    return prisma.$transaction(async (tx) => {
      const terceroId = BigInt(String(dto.terceroId));
      const cuentaId = await this.cuentas.ensureCuenta(tx, dto.organizacionId, terceroId, dto.rol);

      const tercero = await tx.tercero.findUnique({
        where: { id: terceroId },
        select: { nombre: true, cuit: true },
      });

      // === 1) Reservar número único compartido (cabecera + comprobante) ===
      const seq = await this.reservarNumeroOP(tx, dto.organizacionId);
      const numeroOP = seq.numero; // int
      const numeroOPStr = seq.numeroFormateado; // "00000001"

      // === 2) Alta cabecera OP (usa el MISMO número) ===
      const orden = await tx.ordenPagoTercero.create({
        data: {
          organizacionId: dto.organizacionId,
          terceroId,
          cuentaId,
          rol: dto.rol,
          fecha,
          estado: EstadoOrdenPago.confirmado,
          total: totalMetodos,
          numeroOP, // 👈 mismo número público
          observaciones: dto.observaciones ?? null,
        },
        select: { id: true, numeroOP: true },
      });

      // === 3) Métodos ===
      if (dto.metodos.length) {
        await tx.ordenPagoMetodo.createMany({
          data: dto.metodos.map((m) => ({
            ordenId: orden.id,
            metodo: this.toMetodoEnum(m.metodo),
            monto: new Prisma.Decimal(m.monto),
            ref: m.ref ?? null,
          })),
        });
      }

      // === 4) Aplicaciones + marcar “pagado” si corresponde ===
      for (const a of dto.aplicaciones) {
        const compId = BigInt(String(a.comprobanteId));
        const comp = await tx.comprobanteTercero.findUnique({
          where: { id: compId },
          select: { id: true, estado: true, cuentaId: true, total: true },
        });
        if (!comp) throw new Error(`Comprobante ${compId} inexistente`);
        if (comp.cuentaId !== cuentaId)
          throw new Error(`Comprobante ${compId} no pertenece a la misma cuenta/rol`);
        if (comp.estado === 'pagado' || comp.estado === 'anulado')
          throw new Error(`Comprobante ${compId} no aplicable (estado: ${comp.estado})`);

        await tx.ordenPagoAplicacion.create({
          data: {
            ordenId: orden.id,
            comprobanteId: compId,
            montoAplicado: new Prisma.Decimal(a.montoAplicado),
          },
        });

        const applied = await tx.ordenPagoAplicacion.aggregate({
          where: { comprobanteId: compId },
          _sum: { montoAplicado: true },
        });
        const sum = new Prisma.Decimal(applied._sum.montoAplicado ?? 0);
        if (sum.greaterThanOrEqualTo(comp.total)) {
          await tx.comprobanteTercero.update({ where: { id: compId }, data: { estado: 'pagado' } });
        }
      }

      // === 5) Movimiento cuenta + Contabilidad ===
      await this.cuentas.moverSaldo(
        tx,
        cuentaId,
        totalMetodos,
        'credito',
        'orden_pago',
        orden.id,
        `Orden de pago #${numeroOPStr}`,
      );
      await this.contab.onOrdenPagoConfirmada(tx, {
        organizacionId: dto.organizacionId,
        ordenId: orden.id,
      });

      // === 6) Comprobante impreso (usa el MISMO número) ===
      const itemsImpresion = await this.buildItemsDesdeAplicaciones(tx, dto.aplicaciones);
      const formato: 'A4' | 'TICKET_80MM' = 'A4';
      const copias = 2;

      const dtoImp: ImprimirComprobanteDto = {
        tipo: 'ORDEN_PAGO',
        formato,
        copias,
        titulo: 'ORDEN DE PAGO',
        numero: numeroOPStr, // 👈 mismo número visible
        fecha: fecha.toISOString(),
        tercero: { nombre: tercero?.nombre ?? '', cuit: tercero?.cuit ?? null },
        items: itemsImpresion.map((r) => ({
          desc: r.desc,
          cantidad: 1,
          pUnit: r.pUnit,
          importe: r.importe,
        })),
        subtotal: Number(totalMetodos),
        descuentos: 0,
        percepciones: 0,
        impuestos: 0,
        total: Number(totalMetodos),
        notas: dto.observaciones ?? null,
      };

      const { buffer, filename } = await this.impresion.render(dto.organizacionId, dtoImp);
      const { storageKey, hash } = await this.savePdf(buffer as unknown as Buffer, filename);
      const { template, css } = this.resolveTemplatePersist('ORDEN_PAGO', formato);

      const comp = await tx.comprobante.create({
        data: {
          organizacionId: dto.organizacionId,
          tipo: 'ORDEN_PAGO',
          ptoVta: PTOVTA_OP,
          serie: SERIE_OP,
          numero: numeroOP, // 👈 mismo número
          numeroCompleto: numeroOPStr, // “00000001”
          titulo: dtoImp.titulo ?? null,
          fechaEmision: new Date(dtoImp.fecha!),
          terceroNombre: dtoImp.tercero?.nombre ?? null,
          terceroCuit: dtoImp.tercero?.cuit ?? null,
          subtotal: new Prisma.Decimal(dtoImp.subtotal ?? 0),
          descuentos: new Prisma.Decimal(dtoImp.descuentos ?? 0),
          percepciones: new Prisma.Decimal(dtoImp.percepciones ?? 0),
          impuestos: new Prisma.Decimal(dtoImp.impuestos ?? 0),
          total: new Prisma.Decimal(dtoImp.total ?? 0),
          notas: dtoImp.notas ?? null,
          formato: (dtoImp.formato as ComprobanteFormato) ?? ComprobanteFormato.A4,
          copias: dtoImp.copias ?? copias,
          templateArchivo: template,
          templateCss: css,
          templateVersion: process.env.TEMPLATES_VERSION ?? null,
          pdfStorageKey: storageKey,
          pdfHash: hash,
          payload: {
            ...dtoImp,
            origen: { ordenPagoId: orden.id, numeroOP: orden.numeroOP },
          } as unknown as Prisma.InputJsonValue,
          estado: ComprobanteEstado.EMITIDO,
        },
        select: { id: true, numeroCompleto: true },
      });

      if (dtoImp.items?.length) {
        await tx.comprobanteItem.createMany({
          data: dtoImp.items.map((it, i) => ({
            comprobanteId: comp.id,
            orden: i + 1,
            desc: it.desc,
            cantidad: new Prisma.Decimal(it.cantidad ?? 1),
            pUnit: it.pUnit != null ? new Prisma.Decimal(it.pUnit) : null,
            importe: new Prisma.Decimal(it.importe ?? 0),
          })),
        });
      }

      return {
        id: orden.id,
        numeroOP, // int
        numeroOPStr, // “00000001”
        comprobanteId: comp.id,
        comprobanteNumero: comp.numeroCompleto, // “00000001”
        filename,
        pdfStorageKey: storageKey,
      };
    });
  }

  /* ===================== Listar ===================== */

  async listar(
    organizacionId: string,
    filtros: {
      rol?: RolTercero;
      estado?: 'borrador' | 'confirmado' | 'anulado';
      q?: string | null;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, Number(filtros.page ?? 1));
    const pageSize = Math.min(100, Math.max(5, Number(filtros.pageSize ?? 20)));

    const q = (filtros.q ?? '').trim();
    const qDigits = q.replace(/\D+/g, '');
    const qNum = qDigits ? Number(qDigits) : null;

    const where: Prisma.OrdenPagoTerceroWhereInput = {
      organizacionId,
      ...(filtros.rol ? { rol: filtros.rol } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(q
        ? {
            OR: [
              {
                tercero: {
                  OR: [
                    { nombre: { contains: q, mode: 'insensitive' } },
                    { cuit: { contains: qDigits, mode: 'insensitive' } },
                  ],
                },
              },
              ...(qNum ? [{ id: BigInt(qNum) } as Prisma.OrdenPagoTerceroWhereInput] : []),
              ...(qNum ? [{ numeroOP: qNum }] : []),
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.ordenPagoTercero.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          numeroOP: true,
          terceroId: true,
          cuentaId: true,
          rol: true,
          fecha: true,
          estado: true,
          total: true,
          tercero: { select: { id: true, nombre: true, cuit: true } },
        },
      }),
      prisma.ordenPagoTercero.count({ where }),
    ]);

    return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }

  /* ===================== Anular ===================== */

  async anular(organizacionId: string, ordenId: bigint) {
    return prisma.$transaction(async (tx) => {
      const op = await tx.ordenPagoTercero.findFirst({
        where: { id: ordenId, organizacionId, estado: { in: [EstadoOrdenPago.confirmado] } },
        include: {
          cuenta: { select: { id: true } },
          metodos: true,
          aplicaciones: {
            include: { comprobante: { select: { id: true, total: true, estado: true } } },
          },
        },
      });
      if (!op) throw new Error('Orden no anulable');

      const total = op.metodos.reduce((acc, m) => acc.add(new Prisma.Decimal(m.monto)), D(0));
      await this.cuentas.moverSaldo(
        tx,
        op.cuenta.id,
        total,
        'debito',
        'ajuste',
        op.id,
        'Anulación de OP',
      );

      for (const a of op.aplicaciones) {
        const compId = a.comprobante.id;
        const agg = await tx.ordenPagoAplicacion.aggregate({
          where: { comprobanteId: compId, ordenId: { not: op.id } },
          _sum: { montoAplicado: true },
        });
        const aplicadoOtros = D(agg._sum.montoAplicado?.toString() ?? 0);
        if (aplicadoOtros.lessThan(a.comprobante.total)) {
          await tx.comprobanteTercero.update({
            where: { id: compId },
            data: { estado: 'emitido' },
          });
        }
      }

      await tx.ordenPagoTercero.update({
        where: { id: op.id },
        data: { estado: EstadoOrdenPago.anulado },
      });

      await this.contab.onOrdenPagoAnulada(tx, { organizacionId, ordenId: op.id });

      return { ok: true };
    });
  }
}
