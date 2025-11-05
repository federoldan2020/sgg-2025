// src/modulos/terceros-finanzas/comprobantes.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma, EstadoComprobanteTercero, RolTercero } from '@prisma/client';
import { CuentasService } from './cuentas.service';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
import { D, add } from './money';
import { CrearComprobanteDTO } from './comprobantes.dto';
import { movimientoPorComprobante } from './tipos';
import { BadRequestException, ConflictException } from '@nestjs/common';

const prisma = new PrismaClient();

// helper para formatear PV/Nro
function fmtAfip(pv?: number | null, nro?: number | null) {
  const a = (pv ?? 0).toString().padStart(4, '0');
  const b = (nro ?? 0).toString().padStart(8, '0');
  return `${a}-${b}`;
}

const TIPOS_REQUIEREN_PV_NUM = new Set(['FACTURA', 'PRESTACION', 'NOTA_CREDITO', 'NOTA_DEBITO']);

@Injectable()
export class ComprobantesService {
  constructor(
    private cuentas: CuentasService,
    private contab: ContabilidadService,
  ) {}

  private toDec(v?: number | string | null) {
    return v == null || v === '' ? null : new Prisma.Decimal(v);
  }

  private calcLinea(
    cantidad: Prisma.Decimal,
    pu: Prisma.Decimal,
    alicuota?: Prisma.Decimal | null,
  ) {
    const neto = cantidad.mul(pu); // sin IVA
    const iva = alicuota ? neto.mul(alicuota).div(100) : null;
    const total = iva ? neto.add(iva) : neto;
    return { neto, iva, total };
  }

  /** Calcula montos totales desde líneas & impuestos sueltos */
  private resumirMontos(input: CrearComprobanteDTO) {
    let netoGravado21 = D(0);
    let netoGravado105 = D(0);
    let netoGravado27 = D(0);
    let netoNoGravado = D(0);
    // eslint-disable-next-line prefer-const
    let netoExento = D(0);
    let iva21 = D(0);
    let iva105 = D(0);
    let iva27 = D(0);

    // líneas
    for (const l of input.lineas) {
      const cant = new Prisma.Decimal(l.cantidad);
      const pu = new Prisma.Decimal(l.precioUnitario);
      const ali = l.alicuotaIVA == null ? null : new Prisma.Decimal(l.alicuotaIVA);
      const { neto, iva } = this.calcLinea(cant, pu, ali);

      if (!ali || ali.equals(0)) {
        netoNoGravado = add(netoNoGravado, neto);
      } else if (ali.equals(21)) {
        netoGravado21 = add(netoGravado21, neto);
        iva21 = add(iva21, iva ?? D(0));
      } else if (ali.equals(10.5)) {
        netoGravado105 = add(netoGravado105, neto);
        iva105 = add(iva105, iva ?? D(0));
      } else if (ali.equals(27)) {
        netoGravado27 = add(netoGravado27, neto);
        iva27 = add(iva27, iva ?? D(0));
      } else {
        // tasas no estándar: tratamos como gravado “no gravado” (o podrías crear campo adicional)
        netoNoGravado = add(netoNoGravado, neto);
      }
    }

    // impuestos sueltos
    let percepIVA = D(0);
    let retIVA = D(0);
    let retGanancias = D(0);
    let percepIIBB = D(0);
    let retIIBB = D(0);
    let impMunicipal = D(0);
    let impInterno = D(0);
    let gastoAdmin = D(0);
    let otrosImpuestos = D(0);

    for (const imp of input.impuestos ?? []) {
      const impDec = new Prisma.Decimal(imp.importe);
      switch (imp.tipo) {
        case 'PERCEPCION_IVA':
          percepIVA = add(percepIVA, impDec);
          break;
        case 'RETENCION_IVA':
          retIVA = add(retIVA, impDec);
          break;
        case 'RETENCION_GANANCIAS':
          retGanancias = add(retGanancias, impDec);
          break;
        case 'PERCEPCION_IIBB':
          percepIIBB = add(percepIIBB, impDec);
          break;
        case 'RETENCION_IIBB':
          retIIBB = add(retIIBB, impDec);
          break;
        case 'IMP_MUNICIPAL':
          impMunicipal = add(impMunicipal, impDec);
          break;
        case 'IMP_INTERNO':
          impInterno = add(impInterno, impDec);
          break;
        case 'GASTO_ADMINISTRATIVO':
          gastoAdmin = add(gastoAdmin, impDec);
          break;
        default:
          // OTRO u otros -> acumula en otrosImpuestos
          otrosImpuestos = add(otrosImpuestos, impDec);
      }
    }

    const subtotal = netoGravado21
      .add(netoGravado105)
      .add(netoGravado27)
      .add(netoNoGravado)
      .add(netoExento);

    const ivaTotal = iva21.add(iva105).add(iva27);

    const total = subtotal
      .add(ivaTotal)
      .add(percepIVA)
      .add(retIVA)
      .add(retGanancias)
      .add(percepIIBB)
      .add(retIIBB)
      .add(impMunicipal)
      .add(impInterno)
      .add(gastoAdmin)
      .add(otrosImpuestos);

    return {
      netoGravado21,
      netoGravado105,
      netoGravado27,
      netoNoGravado,
      netoExento,
      iva21,
      iva105,
      iva27,
      percepIVA,
      retIVA,
      retGanancias,
      percepIIBB,
      retIIBB,
      impMunicipal,
      impInterno,
      gastoAdmin,
      otrosImpuestos,
      total,
    };
  }

  /** Crea comprobante + impacta saldo (movimiento) en la cuenta del rol */
  async crear(dto: CrearComprobanteDTO) {
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    const venc = dto.vencimiento ? new Date(dto.vencimiento) : null;
    const moneda = dto.moneda ?? 'ARS';
    const tc = dto.tc == null ? null : new Prisma.Decimal(dto.tc);

    // ✅ Validaciones previas
    if (TIPOS_REQUIEREN_PV_NUM.has(dto.tipo)) {
      if (dto.puntoVenta == null || dto.numero == null) {
        throw new BadRequestException('Punto de venta y número son obligatorios para este tipo.');
      }
      if (dto.puntoVenta < 1 || dto.puntoVenta > 9999) {
        throw new BadRequestException('Punto de venta inválido (1..9999).');
      }
      if (dto.numero < 1 || dto.numero > 99999999) {
        throw new BadRequestException('Número inválido (1..99.999.999).');
      }
    }

    return prisma.$transaction(async (tx) => {
      // asegurar cuenta
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const terceroId = BigInt(dto.terceroId as any);
      const cuentaId = await this.cuentas.ensureCuenta(tx, dto.organizacionId, terceroId, dto.rol);

      // (opcional) validar CUIT emisor
      if (dto.cuitEmisor) {
        const ter = await tx.tercero.findUnique({
          where: { id: terceroId },
          select: { cuit: true },
        });
        if (ter?.cuit && ter.cuit.replace(/\D+/g, '') !== dto.cuitEmisor.replace(/\D+/g, '')) {
          throw new BadRequestException('El CUIT emisor no coincide con el CUIT del tercero.');
        }
      }

      // ✅ Pre-chequeo de duplicado “amigable”
      if (TIPOS_REQUIEREN_PV_NUM.has(dto.tipo)) {
        const dup = await tx.comprobanteTercero.findFirst({
          where: {
            organizacionId: dto.organizacionId,
            terceroId,
            tipo: dto.tipo,
            clase: dto.clase ?? null,
            puntoVenta: dto.puntoVenta ?? null,
            numero: dto.numero ?? null,
          },
          select: { id: true },
        });
        if (dup) {
          const nro = fmtAfip(dto.puntoVenta, dto.numero);
          throw new ConflictException(
            `Ya existe el comprobante ${dto.tipo}${dto.clase ? ' ' + dto.clase : ''} ${nro} para este tercero.`,
          );
        }
      }

      // totales
      const tot = this.resumirMontos(dto);

      // alta cabecera
      const cab = await tx.comprobanteTercero.create({
        data: {
          organizacionId: dto.organizacionId,
          terceroId,
          cuentaId,
          rol: dto.rol,
          tipo: dto.tipo,
          clase: dto.clase ?? null,
          puntoVenta: dto.puntoVenta ?? null,
          numero: dto.numero ?? null,
          fecha,
          vencimiento: venc,
          moneda,
          tc,
          estado: 'emitido',
          netoGravado21: tot.netoGravado21,
          netoGravado105: tot.netoGravado105,
          netoGravado27: tot.netoGravado27,
          netoNoGravado: tot.netoNoGravado,
          netoExento: tot.netoExento,
          iva21: tot.iva21,
          iva105: tot.iva105,
          iva27: tot.iva27,
          percepIVA: tot.percepIVA,
          retIVA: tot.retIVA,
          retGanancias: tot.retGanancias,
          percepIIBB: tot.percepIIBB,
          retIIBB: tot.retIIBB,
          impMunicipal: tot.impMunicipal,
          impInterno: tot.impInterno,
          gastoAdmin: tot.gastoAdmin,
          otrosImpuestos: tot.otrosImpuestos,
          total: tot.total,
          cuitEmisor: dto.cuitEmisor ?? null,
          observaciones: dto.observaciones ?? null,
        },
        select: { id: true, total: true },
      });

      // líneas
      if (dto.lineas.length) {
        await tx.comprobanteTerceroLinea.createMany({
          data: dto.lineas.map((l) => ({
            comprobanteId: cab.id,
            descripcion: l.descripcion,
            cantidad: new Prisma.Decimal(l.cantidad),
            precioUnitario: new Prisma.Decimal(l.precioUnitario),
            alicuotaIVA: this.toDec(l.alicuotaIVA),
            importeNeto: new Prisma.Decimal(l.cantidad).mul(new Prisma.Decimal(l.precioUnitario)),
            importeIVA:
              l.alicuotaIVA == null
                ? null
                : new Prisma.Decimal(l.cantidad)
                    .mul(new Prisma.Decimal(l.precioUnitario))
                    .mul(new Prisma.Decimal(l.alicuotaIVA))
                    .div(100),
            importeTotal:
              l.alicuotaIVA == null
                ? new Prisma.Decimal(l.cantidad).mul(new Prisma.Decimal(l.precioUnitario))
                : new Prisma.Decimal(l.cantidad)
                    .mul(new Prisma.Decimal(l.precioUnitario))
                    .mul(new Prisma.Decimal(1).add(new Prisma.Decimal(l.alicuotaIVA).div(100))),
          })),
        });
      }

      // impuestos sueltos
      if (dto.impuestos?.length) {
        await tx.comprobanteTerceroImpuesto.createMany({
          data: dto.impuestos.map((i) => ({
            comprobanteId: cab.id,
            tipo: i.tipo,
            detalle: i.detalle ?? null,
            jurisdiccion: i.jurisdiccion ?? null,
            alicuota: i.alicuota == null ? null : new Prisma.Decimal(i.alicuota),
            baseImponible: i.baseImponible == null ? null : new Prisma.Decimal(i.baseImponible),
            importe: new Prisma.Decimal(i.importe),
          })),
        });
      }

      // movimiento (impacto en saldo)
      const { tipo, origen } = movimientoPorComprobante(dto.tipo);
      await this.cuentas.moverSaldo(
        tx,
        cuentaId,
        cab.total, // 👈 usamos el total real persistido
        tipo,
        origen,
        cab.id,
        `${dto.tipo}${dto.clase ? ' ' + dto.clase : ''} ${fmtAfip(dto.puntoVenta ?? 0, dto.numero ?? 0)}`,
      );

      // Contabilización (doble partida)
      await this.contab.onComprobanteEmitido(tx, {
        organizacionId: dto.organizacionId,
        comprobanteId: cab.id,
      });

      // devolvemos total consistente (nada de 0,00 en front)
      return { id: cab.id, total: Number(cab.total) };
    });
  }

  /** Anula comprobante: valida que no tenga pagos aplicados, revierte saldo, marca estado y genera reversa contable */
  async anular(organizacionId: string, comprobanteId: bigint) {
    return prisma.$transaction(async (tx) => {
      // 1) Comprobante válido
      const comp = await tx.comprobanteTercero.findFirst({
        where: { id: comprobanteId, organizacionId, estado: { in: ['emitido', 'contabilizado'] } },
        select: { id: true, cuentaId: true, tipo: true, total: true },
      });
      if (!comp) throw new Error('Comprobante no anulable');

      // 2) No permitir anular si tiene OP aplicadas (primero hay que anular esos pagos)
      const aplicaciones = await tx.ordenPagoAplicacion.count({
        where: { comprobanteId: comp.id },
      });
      if (aplicaciones > 0) {
        throw new Error(
          'No se puede anular: el comprobante tiene pagos aplicados. Anulá esas OP primero.',
        );
      }

      // 3) Reversa de saldo (si al crear fue débito, acá crédito; y viceversa)
      const base = movimientoPorComprobante(comp.tipo);
      const tipoRev = base.tipo === 'debito' ? 'credito' : 'debito';
      await this.cuentas.moverSaldo(
        tx,
        comp.cuentaId,
        comp.total,
        tipoRev,
        'ajuste',
        comp.id,
        'Anulación de comprobante',
      );

      // 4) Estado → anulado
      await tx.comprobanteTercero.update({
        where: { id: comp.id },
        data: { estado: 'anulado' as EstadoComprobanteTercero },
      });

      // 5) Reversa contable (doble partida)
      await this.contab.onComprobanteAnulado(tx, {
        organizacionId,
        comprobanteId: comp.id,
      });

      return { ok: true };
    });
  }

  async listar(
    organizacionId: string,
    filtros: { rol?: string; estado?: string; q?: string | null; page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, Number(filtros.page ?? 1));
    const pageSize = Math.min(100, Math.max(5, Number(filtros.pageSize ?? 20)));

    const where: Prisma.ComprobanteTerceroWhereInput = {
      organizacionId,
      ...(filtros.rol ? { rol: filtros.rol as any } : {}),
      ...(filtros.estado ? { estado: filtros.estado as any } : {}),
      ...(filtros.q
        ? {
            OR: [
              { observaciones: { contains: filtros.q, mode: 'insensitive' } },
              { cuitEmisor: { contains: filtros.q } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.comprobanteTercero.findMany({
        where,
        orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          terceroId: true,
          cuentaId: true,
          rol: true,
          tipo: true,
          clase: true,
          puntoVenta: true,
          numero: true,
          fecha: true,
          estado: true,
          total: true,
        },
      }),
      prisma.comprobanteTercero.count({ where }),
    ]);

    return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }

  // ADD: obtener comprobantes "emitido" con saldo pendiente para un tercero+rol
  async pendientesPorTercero(
    organizacionId: string,
    opts: { terceroId: bigint; rol: RolTercero; limit?: number },
  ) {
    const limit = Math.min(500, Math.max(1, Number(opts.limit ?? 200)));

    // 1) Traemos solo los que generan deuda
    const comps = await prisma.comprobanteTercero.findMany({
      where: {
        organizacionId,
        terceroId: opts.terceroId,
        rol: opts.rol,
        estado: { in: ['emitido', 'contabilizado'] },
        tipo: { in: ['FACTURA', 'PRESTACION', 'NOTA_DEBITO'] },
      },
      orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
      take: limit,
      select: {
        id: true,
        tipo: true,
        clase: true,
        numero: true,
        fecha: true,
        total: true,
        // 2) Solo aplicaciones de OP confirmadas (no anuladas)
        aplicaciones: {
          where: { orden: { estado: 'confirmado' } },
          select: { montoAplicado: true },
        },
      },
    });

    // 3) Armamos respuesta tipando todo a Number para evitar Decimals en el front
    const rows = comps.map((c) => {
      const total = Number(c.total ?? 0);
      const aplicadoPrevio = (c.aplicaciones ?? []).reduce(
        (acc, a) => acc + Number(a.montoAplicado ?? 0),
        0,
      );
      const saldo = Math.max(0, Number(new Prisma.Decimal(total).minus(aplicadoPrevio)));

      return {
        id: c.id.toString(),
        tipo: c.tipo,
        clase: c.clase ?? null,
        numero: c.numero != null ? String(c.numero) : null,
        fecha: c.fecha.toISOString(),
        total,
        aplicadoPrevio,
        saldo,
      };
    });

    // 4) (Opcional) dejamos sólo los que todavía tienen saldo > 0
    return rows.filter((r) => r.saldo > 0.000001);
  }
}
