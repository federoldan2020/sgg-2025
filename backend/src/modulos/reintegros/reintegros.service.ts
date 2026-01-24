import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  ReintegroEstado,
  ReintegroPersonaTipo,
  ReintegroTipo,
  RolTercero,
  TipoComprobanteTercero,
  EstadoComprobanteTercero,
  ComprobanteTipo,
  ComprobanteEstado,
  ComprobanteFormato,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { OrdenesPagoService } from '../terceros-finanzas/ordenes-pago.service';
import { CuentasService } from '../terceros-finanzas/cuentas.service';
import { ImpresionService, ImprimirComprobanteDto } from '../impresion/impresion.service';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as crypto from 'crypto';

type IdLike = string | number | bigint;
const toBig = (v: IdLike) => {
  try {
    return typeof v === 'bigint' ? v : BigInt(v);
  } catch {
    throw new BadRequestException('Identificador inválido');
  }
};

@Injectable()
export class ReintegrosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordenesPago: OrdenesPagoService,
    private readonly cuentas: CuentasService,
    private readonly impresion: ImpresionService,
  ) {}

  private async ensureAfiliadoInOrg(organizacionId: string, afiliadoId: IdLike) {
    const id = toBig(afiliadoId);
    const ok = await this.prisma.afiliado.findFirst({
      where: { id, organizacionId },
      select: { id: true },
    });
    if (!ok) throw new NotFoundException('Afiliado no encontrado en la organización');
    return id;
  }

  private async ensureFamiliar(afiliadoId: bigint, familiarId?: IdLike) {
    if (familiarId == null) return null;
    const id = toBig(familiarId);
    const col = await this.prisma.colateral.findFirst({
      where: { id, afiliadoId },
      select: { id: true },
    });
    if (!col) throw new NotFoundException('Familiar no encontrado para el afiliado');
    return id;
  }

  private parseFecha(fecha?: string) {
    if (!fecha) throw new BadRequestException('fechaFactura requerida');
    const d = new Date(fecha);
    if (isNaN(d.getTime())) throw new BadRequestException('fechaFactura invalida');
    return d;
  }

  private sumItems(items: { cantidad: number; importe: number }[]) {
    let total = 0;
    for (const it of items) {
      const cant = Number(it.cantidad ?? 0);
      const imp = Number(it.importe ?? 0);
      total += cant > 0 ? imp * cant : imp;
    }
    return total;
  }

  private async getPolitica(organizacionId: string, at: Date) {
    return this.prisma.reintegroPolitica.findFirst({
      where: {
        organizacionId,
        activo: true,
        vigenteDesde: { lte: at },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: at } }],
      },
      orderBy: { vigenteDesde: 'desc' },
    });
  }

  private normalizeAdjuntoTipo(tipo?: string) {
    if (!tipo) return null;
    const t = tipo.toUpperCase();
    if (!['FACTURA', 'RECETA', 'ORDEN', 'INFORME', 'OTRO'].includes(t)) return null;
    return t as 'FACTURA' | 'RECETA' | 'ORDEN' | 'INFORME' | 'OTRO';
  }

  private normalizeMedioPago(tipo?: string) {
    if (!tipo) return 'OTRO' as const;
    const t = tipo.toUpperCase();
    if (!['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'OTRO'].includes(t)) return null;
    return t as 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'OTRO';
  }

  private async savePdf(buffer: Buffer, filename: string) {
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const dir = path.join(process.cwd(), 'storage', 'comprobantes');
    await fs.mkdir(dir, { recursive: true });
    const full = path.join(dir, filename);
    await fs.writeFile(full, buffer);
    return { storageKey: `file://${full}`, hash };
  }

  private resolveTemplatePersist(formato: 'A4' | 'A5' | 'TICKET_80MM') {
    const base = 'reintegro_afiliado';
    const template = formato === 'TICKET_80MM' ? `${base}.ticket.njk` : `${base}.a4.njk`;
    const css = formato === 'TICKET_80MM' ? 'ticket-80mm.css' : 'a4.css';
    return { template, css };
  }

  private toMetodoPagoOP(medio: 'EFECTIVO' | 'TRANSFERENCIA' | 'CHEQUE' | 'OTRO') {
    switch (medio) {
      case 'EFECTIVO':
        return 'efectivo';
      case 'TRANSFERENCIA':
        return 'transferencia';
      case 'CHEQUE':
        return 'cheque';
      default:
        return 'otro';
    }
  }

  private async reservarNumeroComprobante(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    tipo: ComprobanteTipo,
    ptoVta = 1,
    serie: string | null = null,
    longitud = 8,
  ) {
    for (let i = 0; i < 3; i++) {
      const exist = await tx.numerador.findFirst({
        where: { organizacionId, tipo, ptoVta, serie },
        select: { id: true, longitud: true },
      });
      if (exist) {
        const upd = await tx.numerador.update({
          where: { id: exist.id },
          data: { ultimoNumero: { increment: 1 } },
          select: { ultimoNumero: true, longitud: true },
        });
        const numero = upd.ultimoNumero;
        const numeroFormateado = String(numero).padStart(upd.longitud ?? longitud, '0');
        return { numero, numeroFormateado };
      }

      const agg = await tx.comprobante.aggregate({
        where: { organizacionId, tipo, ptoVta, serie },
        _max: { numero: true },
      });
      const start = (agg._max.numero ?? 0) + 1;
      try {
        const created = await tx.numerador.create({
          data: {
            organizacionId,
            tipo,
            ptoVta,
            serie,
            ultimoNumero: start,
            longitud,
          },
          select: { ultimoNumero: true, longitud: true },
        });
        const numero = created.ultimoNumero;
        const numeroFormateado = String(numero).padStart(created.longitud ?? longitud, '0');
        return { numero, numeroFormateado };
      } catch (e: unknown) {
        if ((e as { code?: string })?.code !== 'P2002') throw e;
      }
    }
    throw new Error('No se pudo reservar número de comprobante');
  }

  private async crearComprobanteReintegro(
    organizacionId: string,
    terceroId: bigint,
    solicitud: any,
    montoFinal: number,
  ) {
    const formato: 'A4' | 'TICKET_80MM' = 'A4';
    const { numero, numeroFormateado } = await this.prisma.$transaction(async (tx) =>
      this.reservarNumeroComprobante(tx, organizacionId, ComprobanteTipo.REINTEGRO_AFILIADO),
    );
    const numeroCompleto = `${String(1).padStart(4, '0')}-${numeroFormateado}`;

    const items = (solicitud.items ?? []).map((i: any) => ({
      desc: i.descripcion,
      cantidad: Number(i.cantidad ?? 1),
      pUnit: Number(i.importe ?? 0),
      importe: Number(i.cantidad ?? 1) * Number(i.importe ?? 0),
    }));

    const dtoImp: ImprimirComprobanteDto = {
      tipo: 'REINTEGRO_AFILIADO',
      formato,
      copias: 2,
      titulo: 'REINTEGRO',
      numero: numeroCompleto,
      fecha: new Date().toISOString(),
      tercero: { nombre: solicitud?.terceroNombre ?? 'AFILIADO', cuit: solicitud?.terceroCuit ?? null },
      items,
      subtotal: montoFinal,
      descuentos: 0,
      percepciones: 0,
      impuestos: 0,
      total: montoFinal,
      notas: `Reintegro solicitud #${solicitud.id.toString()}`,
    };

    const { buffer, filename } = await this.impresion.render(organizacionId, dtoImp);
    const { storageKey, hash } = await this.savePdf(buffer as unknown as Buffer, filename);
    const { template, css } = this.resolveTemplatePersist(formato);

    const comp = await this.prisma.comprobante.create({
      data: {
        organizacionId,
        tipo: ComprobanteTipo.REINTEGRO_AFILIADO,
        ptoVta: 1,
        serie: null,
        numero,
        numeroCompleto,
        titulo: dtoImp.titulo ?? null,
        fechaEmision: new Date(dtoImp.fecha!),
        terceroId: terceroId.toString(),
        terceroNombre: dtoImp.tercero?.nombre ?? null,
        terceroCuit: dtoImp.tercero?.cuit ?? null,
        subtotal: new Prisma.Decimal(dtoImp.subtotal ?? 0),
        descuentos: new Prisma.Decimal(dtoImp.descuentos ?? 0),
        percepciones: new Prisma.Decimal(dtoImp.percepciones ?? 0),
        impuestos: new Prisma.Decimal(dtoImp.impuestos ?? 0),
        total: new Prisma.Decimal(dtoImp.total ?? 0),
        notas: dtoImp.notas ?? null,
        formato: (dtoImp.formato as ComprobanteFormato) ?? ComprobanteFormato.A4,
        copias: dtoImp.copias ?? 2,
        templateArchivo: template,
        templateCss: css,
        templateVersion: process.env.TEMPLATES_VERSION ?? null,
        pdfStorageKey: storageKey,
        pdfHash: hash,
        payload: dtoImp as unknown as Prisma.InputJsonValue,
        estado: ComprobanteEstado.EMITIDO,
        items: {
          create: items.map((it, i) => ({
            orden: i + 1,
            desc: it.desc,
            cantidad: new Prisma.Decimal(it.cantidad ?? 1),
            pUnit: it.pUnit != null ? new Prisma.Decimal(it.pUnit) : null,
            importe: new Prisma.Decimal(it.importe ?? 0),
          })),
        },
      },
      select: { id: true, numeroCompleto: true, pdfStorageKey: true },
    });

    return comp;
  }

  private async ensureTerceroAfiliado(organizacionId: string, afiliadoId: bigint) {
    const afiliado = await this.prisma.afiliado.findFirst({
      where: { id: afiliadoId, organizacionId },
      select: { apellido: true, nombre: true, dni: true, cuit: true },
    });
    if (!afiliado) throw new NotFoundException('Afiliado no encontrado');

    const codigo = `AFI-${afiliadoId.toString()}`;
    const existente = await this.prisma.tercero.findFirst({
      where: { organizacionId, codigo },
      select: { id: true },
    });
    if (existente) {
      const rol = await this.prisma.terceroRol.findFirst({
        where: { terceroId: existente.id, rol: RolTercero.AFILIADO },
        select: { id: true },
      });
      if (!rol) {
        await this.prisma.terceroRol.create({
          data: { terceroId: existente.id, rol: RolTercero.AFILIADO },
        });
      }
      return existente.id;
    }

    const nombre = `${afiliado.apellido} ${afiliado.nombre}`.trim();
    const tercero = await this.prisma.tercero.create({
      data: {
        organizacionId,
        codigo,
        nombre: nombre || `Afiliado ${afiliadoId.toString()}`,
        cuit: afiliado.cuit ?? String(afiliado.dni),
        activo: true,
      },
      select: { id: true },
    });
    await this.prisma.terceroRol.create({
      data: { terceroId: tercero.id, rol: RolTercero.AFILIADO },
    });
    return tercero.id;
  }

  private getRequisitosAdjuntos(politica: any, tipo: ReintegroTipo) {
    const reqs = politica?.requisitosAdjuntos ?? null;
    if (!reqs) return [];
    const porTipo = reqs[tipo] ?? reqs[tipo.toLowerCase()];
    return Array.isArray(porTipo) ? porTipo.map((r: string) => String(r).toUpperCase()) : [];
  }

  private diffAdjuntos(requeridos: string[], presentes: string[]) {
    const set = new Set(presentes.map((p) => p.toUpperCase()));
    return requeridos.filter((r) => !set.has(r.toUpperCase()));
  }

  private async getSolicitud(organizacionId: string, id: IdLike) {
    const sol = await this.prisma.reintegroSolicitud.findFirst({
      where: { organizacionId, id: toBig(id) },
      include: { items: true },
    });
    if (!sol) throw new NotFoundException('Solicitud no encontrada');
    return sol;
  }

  private async addHistorial(
    tx: Prisma.TransactionClient,
    solicitudId: bigint,
    estadoAnterior: ReintegroEstado | null,
    estadoNuevo: ReintegroEstado,
    observacion?: string,
    actorId?: string,
    payloadAntes?: Prisma.JsonValue,
    payloadDespues?: Prisma.JsonValue,
  ) {
    await tx.reintegroHistorialEstado.create({
      data: {
        solicitudId,
        estadoAnterior: estadoAnterior ?? undefined,
        estadoNuevo,
        observacion: observacion?.trim() || null,
        actorId: actorId?.trim() || null,
        payloadAntes: payloadAntes ?? undefined,
        payloadDespues: payloadDespues ?? undefined,
      },
    });
  }

  private estadosConsumenOrden(): ReintegroEstado[] {
    return [
      ReintegroEstado.PRESENTADO,
      ReintegroEstado.EN_REVISION,
      ReintegroEstado.OBSERVADO,
      ReintegroEstado.APROBADO,
      ReintegroEstado.A_PAGAR,
      ReintegroEstado.PAGADO,
      ReintegroEstado.CERRADO,
    ];
  }

  private getYearRange(fecha: Date) {
    const year = fecha.getFullYear();
    const desde = new Date(`${year}-01-01T00:00:00.000Z`);
    const hasta = new Date(`${year}-12-31T23:59:59.999Z`);
    return { desde, hasta, year };
  }

  private countKeyword(items: { descripcion: string }[], keyword: string) {
    const k = keyword.toLowerCase();
    return items.filter((i) => (i.descripcion ?? '').toLowerCase().includes(k)).length;
  }

  private normalizeMotivos(motivos: string[]) {
    return Array.from(new Set(motivos));
  }

  async crearBorrador(
    organizacionId: string,
    body: {
      personaTipo?: 'TITULAR' | 'FAMILIAR';
      afiliadoId?: IdLike;
      familiarId?: IdLike;
      tipo?: 'MEDICAMENTO' | 'PRACTICA';
      fechaFactura?: string;
      items?: { descripcion: string; cantidad: number; importe: number; porcentaje?: number; tipoItem?: 'MEDICAMENTO' | 'PRACTICA' }[];
    },
  ) {
    if (!body?.personaTipo) throw new BadRequestException('personaTipo requerido');
    if (!body?.afiliadoId) throw new BadRequestException('afiliadoId requerido');
    if (body.personaTipo === 'FAMILIAR' && !body.familiarId)
      throw new BadRequestException('familiarId requerido');
    if (!body?.tipo) throw new BadRequestException('tipo requerido');
    const items = body?.items ?? [];
    if (!items.length) throw new BadRequestException('items requeridos');

    const afId = await this.ensureAfiliadoInOrg(organizacionId, body.afiliadoId);
    const famId =
      body.personaTipo === 'FAMILIAR' ? await this.ensureFamiliar(afId, body.familiarId) : null;
    const fechaFactura = this.parseFecha(body.fechaFactura);

    const validacion = await this.validar(organizacionId, {
      personaTipo: body.personaTipo,
      afiliadoId: afId,
      familiarId: famId ?? undefined,
      tipo: body.tipo,
      fechaFactura: body.fechaFactura,
      importe: this.sumItems(items),
      items,
    });
    if (!validacion.eligible) {
      throw new BadRequestException({
        message: 'No elegible para reintegro',
        motivos: validacion.motivos,
      });
    }

    const importeTotal = this.sumItems(items);
    
    // Calcular importeReintegro aplicando porcentajes
    let importeReintegro = 0;
    for (const it of items) {
      const cantidad = Number(it.cantidad ?? 1);
      const importe = Number(it.importe ?? 0);
      const porcentaje = Number(it.porcentaje ?? 100);
      const subtotal = cantidad * importe;
      importeReintegro += subtotal * (porcentaje / 100);
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const dataCreate: any = {
        organizacionId,
        personaTipo: body.personaTipo as ReintegroPersonaTipo,
        afiliadoId: afId,
        familiarId: famId ?? null,
        tipo: body.tipo as ReintegroTipo,
        estado: ReintegroEstado.BORRADOR,
        fechaFactura,
        importeTotal: new Prisma.Decimal(importeTotal),
        items: {
          create: items.map((it) => {
            const itemData: any = {
              descripcion: it.descripcion?.trim() || 'Item',
              cantidad: Number(it.cantidad ?? 1),
              importe: new Prisma.Decimal(Number(it.importe ?? 0)),
              tipoItem: (it.tipoItem ?? body.tipo) as ReintegroTipo,
            };
            // Agregar porcentaje si el campo existe en el schema
            if (it.porcentaje != null) {
              itemData.porcentaje = new Prisma.Decimal(Number(it.porcentaje ?? 100));
            }
            return itemData;
          }),
        },
      };
      // Agregar importeReintegro si el campo existe en el schema
      if (importeReintegro > 0) {
        dataCreate.importeReintegro = new Prisma.Decimal(importeReintegro);
      }

      const row = await tx.reintegroSolicitud.create({
        data: dataCreate,
        select: { id: true, estado: true },
      });
      await this.addHistorial(tx, row.id, null, ReintegroEstado.BORRADOR, 'Creacion borrador');
      return row;
    });

    return { id: created.id.toString(), estado: created.estado };
  }

  async listar(
    organizacionId: string,
    params: {
      q?: string;
      estado?: string;
      tipo?: string;
      afiliadoId?: string;
      desde?: string;
      hasta?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 20;

    let afiliadoIdBig: bigint | null = null;
    if (params.afiliadoId) {
      try {
        afiliadoIdBig = BigInt(params.afiliadoId);
      } catch {
        afiliadoIdBig = null;
      }
    }

    const where: Prisma.ReintegroSolicitudWhereInput = {
      organizacionId,
      ...(params.estado ? { estado: params.estado as ReintegroEstado } : {}),
      ...(params.tipo ? { tipo: params.tipo as ReintegroTipo } : {}),
      ...(afiliadoIdBig != null ? { afiliadoId: afiliadoIdBig } : {}),
      ...(params.desde || params.hasta
        ? {
            fechaFactura: {
              ...(params.desde ? { gte: new Date(params.desde) } : {}),
              ...(params.hasta ? { lte: new Date(params.hasta) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.reintegroSolicitud.findMany({
        where,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: true,
          pagos: {
            select: {
              id: true,
              ordenPagoId: true,
              monto: true,
            },
          },
          afiliado: {
            select: {
              apellido: true,
              nombre: true,
            },
          },
          familiar: {
            select: {
              nombre: true,
            },
          },
        },
      }),
      this.prisma.reintegroSolicitud.count({ where }),
    ]);

    // Mapear los items para incluir nombres y calcular reintegro
    const itemsMapeados = items.map((item) => {
      const afiliadoNombre = item.afiliado
        ? `${item.afiliado.apellido || ''} ${item.afiliado.nombre || ''}`.trim() || null
        : null;
      const familiarNombre = item.familiar?.nombre || null;

      // Usar importeReintegro si existe, sino calcularlo desde los items
      let importeReintegro = 0;
      if (item.importeReintegro != null) {
        importeReintegro = Number(item.importeReintegro);
      } else {
        // Calcular desde items (para registros antiguos sin importeReintegro)
        for (const it of item.items) {
          const cantidad = Number(it.cantidad ?? 1);
          const importe = Number(it.importe ?? 0);
          const porcentaje = it.porcentaje != null ? Number(it.porcentaje) : 100;
          const subtotal = cantidad * importe;
          importeReintegro += subtotal * (porcentaje / 100);
        }
      }

      return {
        ...item,
        afiliadoNombre,
        familiarNombre,
        importeReintegro: importeReintegro.toFixed(2),
        pagos: item.pagos ?? [],
      };
    });

    return {
      items: itemsMapeados,
      total,
      page,
      pageSize,
      pages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async getDetalle(organizacionId: string, id: string) {
    const row = await this.prisma.reintegroSolicitud.findFirst({
      where: { organizacionId, id: BigInt(id) },
      include: {
        items: true,
        adjuntos: true,
        historial: true,
        pagos: { include: { comprobante: { select: { numeroCompleto: true, pdfStorageKey: true } } } },
      },
    });
    if (!row) throw new NotFoundException('Solicitud no encontrada');
    return row;
  }

  async presentar(organizacionId: string, id: string, observacion?: string, actorId?: string) {
    const solicitud = await this.getSolicitud(organizacionId, id);
    if (solicitud.estado !== ReintegroEstado.BORRADOR) {
      throw new BadRequestException('Solo se puede presentar un borrador');
    }
    const politica = await this.getPolitica(
      organizacionId,
      new Date(solicitud.fechaFactura),
    );
    const requisitos = this.getRequisitosAdjuntos(politica, solicitud.tipo);
    if (requisitos.length > 0) {
      const adjuntos = await this.prisma.reintegroAdjunto.findMany({
        where: { solicitudId: solicitud.id },
        select: { tipoAdjunto: true },
      });
      const faltantes = this.diffAdjuntos(
        requisitos,
        adjuntos.map((a) => a.tipoAdjunto),
      );
      if (faltantes.length > 0) {
        throw new BadRequestException({
          message: 'Faltan adjuntos requeridos',
          faltantes,
        });
      }
    }
    const validacion = await this.validar(organizacionId, {
      personaTipo: solicitud.personaTipo as any,
      afiliadoId: solicitud.afiliadoId,
      familiarId: solicitud.familiarId ?? undefined,
      tipo: solicitud.tipo as any,
      fechaFactura: solicitud.fechaFactura.toISOString().slice(0, 10),
      importe: Number(solicitud.importeTotal),
      items: solicitud.items.map((i) => ({
        descripcion: i.descripcion,
        cantidad: i.cantidad,
        importe: Number(i.importe),
        tipoItem: i.tipoItem as any,
      })),
    });
    if (!validacion.eligible) {
      throw new BadRequestException({
        message: 'No elegible para presentar',
        motivos: validacion.motivos,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.reintegroSolicitud.update({
        where: { id: solicitud.id },
        data: { estado: ReintegroEstado.PRESENTADO, fechaPresentacion: new Date() },
      });
      await this.addHistorial(
        tx,
        solicitud.id,
        solicitud.estado,
        ReintegroEstado.PRESENTADO,
        observacion ?? 'Presentada',
        actorId,
      );
    });

    return { ok: true, estado: ReintegroEstado.PRESENTADO };
  }

  async observar(organizacionId: string, id: string, observacion?: string, actorId?: string) {
    const solicitud = await this.getSolicitud(organizacionId, id);
    const estadosPermitidos: ReintegroEstado[] = [
      ReintegroEstado.PRESENTADO,
      ReintegroEstado.EN_REVISION,
      ReintegroEstado.OBSERVADO,
    ];
    if (!estadosPermitidos.includes(solicitud.estado)) {
      throw new BadRequestException('Estado no permite observar');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.reintegroSolicitud.update({
        where: { id: solicitud.id },
        data: { estado: ReintegroEstado.OBSERVADO },
      });
      await this.addHistorial(
        tx,
        solicitud.id,
        solicitud.estado,
        ReintegroEstado.OBSERVADO,
        observacion ?? 'Observada',
        actorId,
      );
    });
    return { ok: true, estado: ReintegroEstado.OBSERVADO };
  }

  async aprobar(
    organizacionId: string,
    id: string,
    importeAprobado?: number,
    observacion?: string,
    actorId?: string,
  ) {
    const solicitud = await this.getSolicitud(organizacionId, id);
    const estadosPermitidos: ReintegroEstado[] = [
      ReintegroEstado.PRESENTADO,
      ReintegroEstado.EN_REVISION,
      ReintegroEstado.OBSERVADO,
    ];
    if (!estadosPermitidos.includes(solicitud.estado)) {
      throw new BadRequestException('Estado no permite aprobar');
    }
    const aprobado =
      importeAprobado == null ? Number(solicitud.importeTotal) : Number(importeAprobado);
    if (aprobado < 0) throw new BadRequestException('importeAprobado invalido');
    if (aprobado > Number(solicitud.importeTotal))
      throw new BadRequestException('importeAprobado excede total');

    await this.prisma.$transaction(async (tx) => {
      await tx.reintegroSolicitud.update({
        where: { id: solicitud.id },
        data: { estado: ReintegroEstado.APROBADO, importeAprobado: new Prisma.Decimal(aprobado) },
      });
      await this.addHistorial(
        tx,
        solicitud.id,
        solicitud.estado,
        ReintegroEstado.APROBADO,
        observacion ?? 'Aprobada',
        actorId,
      );
    });
    return { ok: true, estado: ReintegroEstado.APROBADO };
  }

  async rechazar(organizacionId: string, id: string, observacion?: string, actorId?: string) {
    const solicitud = await this.getSolicitud(organizacionId, id);
    const estadosPermitidos: ReintegroEstado[] = [
      ReintegroEstado.PRESENTADO,
      ReintegroEstado.EN_REVISION,
      ReintegroEstado.OBSERVADO,
    ];
    if (!estadosPermitidos.includes(solicitud.estado)) {
      throw new BadRequestException('Estado no permite rechazar');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.reintegroSolicitud.update({
        where: { id: solicitud.id },
        data: { estado: ReintegroEstado.RECHAZADO },
      });
      await this.addHistorial(
        tx,
        solicitud.id,
        solicitud.estado,
        ReintegroEstado.RECHAZADO,
        observacion ?? 'Rechazada',
        actorId,
      );
    });
    return { ok: true, estado: ReintegroEstado.RECHAZADO };
  }

  async agregarAdjunto(
    organizacionId: string,
    solicitudId: IdLike,
    body: {
      tipoAdjunto?: string;
      url?: string;
      hash?: string;
      mime?: string;
      size?: number;
      subidoPorId?: string;
    },
  ) {
    const sol = await this.getSolicitud(organizacionId, solicitudId);
    const tipoAdjunto = this.normalizeAdjuntoTipo(body.tipoAdjunto);
    if (!tipoAdjunto) throw new BadRequestException('tipoAdjunto invalido');
    if (!body?.url?.trim()) throw new BadRequestException('url requerida');

    const adj = await this.prisma.reintegroAdjunto.create({
      data: {
        solicitudId: sol.id,
        tipoAdjunto,
        url: body.url.trim(),
        hash: body.hash?.trim() || null,
        mime: body.mime?.trim() || null,
        size: body.size ?? null,
        subidoPorId: body.subidoPorId?.trim() || null,
      },
      select: { id: true },
    });

    return { id: adj.id.toString() };
  }

  async getComprobantePdf(organizacionId: string, id: string) {
    const solicitudId = toBig(id);
    const pago = await this.prisma.reintegroPago.findFirst({
      where: {
        solicitudId,
        solicitud: { organizacionId },
        comprobanteId: { not: null },
      },
      orderBy: { id: 'desc' },
      include: { comprobante: true },
    });
    if (!pago?.comprobante) throw new NotFoundException('Comprobante no encontrado');
    const storageKey = pago.comprobante.pdfStorageKey;
    if (!storageKey) throw new NotFoundException('Comprobante sin PDF');
    const fullPath = storageKey.startsWith('file://') ? storageKey.slice(7) : storageKey;
    const buffer = await fs.readFile(fullPath);
    return { buffer, filename: path.basename(fullPath) };
  }

  async generarOrdenPago(
    organizacionId: string,
    id: string,
    medioPago?: string,
    monto?: number,
  ) {
    const solicitud = await this.getSolicitud(organizacionId, id);
    if (solicitud.estado !== ReintegroEstado.APROBADO) {
      throw new BadRequestException('Solo se puede generar orden de pago desde APROBADO');
    }
    const mp = this.normalizeMedioPago(medioPago);
    if (!mp) throw new BadRequestException('medioPago invalido');
    const montoBase =
      solicitud.importeAprobado != null
        ? Number(solicitud.importeAprobado)
        : Number(solicitud.importeTotal);
    const montoFinal = monto != null ? Number(monto) : montoBase;
    if (montoFinal <= 0) throw new BadRequestException('monto invalido');

    const terceroId = await this.ensureTerceroAfiliado(organizacionId, solicitud.afiliadoId);
    const cuentaId = await this.cuentas.ensureCuenta(
      this.prisma as unknown as Prisma.TransactionClient,
      organizacionId,
      terceroId,
      RolTercero.AFILIADO,
    );

    const comprobante = await this.prisma.comprobanteTercero.create({
      data: {
        organizacionId,
        terceroId,
        cuentaId,
        rol: RolTercero.AFILIADO,
        tipo: TipoComprobanteTercero.PRESTACION,
        estado: EstadoComprobanteTercero.emitido,
        total: new Prisma.Decimal(montoFinal),
        netoNoGravado: new Prisma.Decimal(montoFinal),
        observaciones: `Reintegro solicitud #${solicitud.id.toString()}`,
        lineas: {
          create: [
            {
              descripcion: `Reintegro solicitud #${solicitud.id.toString()}`,
              cantidad: new Prisma.Decimal(1),
              precioUnitario: new Prisma.Decimal(montoFinal),
              alicuotaIVA: new Prisma.Decimal(0),
              importeNeto: new Prisma.Decimal(montoFinal),
              importeIVA: new Prisma.Decimal(0),
              importeTotal: new Prisma.Decimal(montoFinal),
            },
          ],
        },
      },
      select: { id: true },
    });

    const op = await this.ordenesPago.crear({
      organizacionId,
      terceroId,
      rol: RolTercero.AFILIADO,
      metodos: [{ metodo: this.toMetodoPagoOP(mp), monto: montoFinal }],
      aplicaciones: [{ comprobanteId: comprobante.id, montoAplicado: montoFinal }],
    });

    const tercero = await this.prisma.tercero.findUnique({
      where: { id: terceroId },
      select: { nombre: true, cuit: true },
    });
    const compReintegro = await this.crearComprobanteReintegro(
      organizacionId,
      terceroId,
      {
        ...solicitud,
        terceroNombre: tercero?.nombre ?? null,
        terceroCuit: tercero?.cuit ?? null,
      },
      montoFinal,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.reintegroPago.create({
        data: {
          solicitudId: solicitud.id,
          ordenPagoId: BigInt(String(op.id)),
          comprobanteId: compReintegro.id,
          monto: new Prisma.Decimal(montoFinal),
          medioPago: mp,
          estadoPago: 'PAGADO',
          fechaPago: new Date(),
        },
      });
      await tx.reintegroSolicitud.update({
        where: { id: solicitud.id },
        data: { estado: ReintegroEstado.PAGADO },
      });
      await this.addHistorial(
        tx,
        solicitud.id,
        solicitud.estado,
        ReintegroEstado.PAGADO,
        'Pagado (OP)',
      );
    });

    return {
      ok: true,
      estado: ReintegroEstado.PAGADO,
      ordenPagoId: op.id?.toString?.() ?? null,
      comprobanteId: compReintegro.id,
      comprobanteNumero: compReintegro.numeroCompleto,
      pdfStorageKey: compReintegro.pdfStorageKey,
    };
  }

  async pagar(organizacionId: string, id: string, medioPago?: string, monto?: number) {
    const solicitud = await this.getSolicitud(organizacionId, id);
    if (solicitud.estado !== ReintegroEstado.A_PAGAR) {
      throw new BadRequestException('Solo se puede pagar desde A_PAGAR');
    }
    const mp = this.normalizeMedioPago(medioPago);
    if (!mp) throw new BadRequestException('medioPago invalido');
    const montoBase =
      solicitud.importeAprobado != null
        ? Number(solicitud.importeAprobado)
        : Number(solicitud.importeTotal);
    const montoFinal = monto != null ? Number(monto) : montoBase;
    if (montoFinal <= 0) throw new BadRequestException('monto invalido');

    const terceroId = await this.ensureTerceroAfiliado(organizacionId, solicitud.afiliadoId);
    const tercero = await this.prisma.tercero.findUnique({
      where: { id: terceroId },
      select: { nombre: true, cuit: true },
    });
    const compReintegro = await this.crearComprobanteReintegro(
      organizacionId,
      terceroId,
      {
        ...solicitud,
        terceroNombre: tercero?.nombre ?? null,
        terceroCuit: tercero?.cuit ?? null,
      },
      montoFinal,
    );

    await this.prisma.$transaction(async (tx) => {
      const pago = await tx.reintegroPago.findFirst({
        where: { solicitudId: solicitud.id, estadoPago: 'PENDIENTE' },
        select: { id: true },
      });
      if (pago) {
        await tx.reintegroPago.update({
          where: { id: pago.id },
          data: {
            estadoPago: 'PAGADO',
            medioPago: mp,
            monto: new Prisma.Decimal(montoFinal),
            fechaPago: new Date(),
            comprobanteId: compReintegro.id,
          },
        });
      } else {
        await tx.reintegroPago.create({
          data: {
            solicitudId: solicitud.id,
            monto: new Prisma.Decimal(montoFinal),
            medioPago: mp,
            estadoPago: 'PAGADO',
            fechaPago: new Date(),
            comprobanteId: compReintegro.id,
          },
        });
      }

      await tx.reintegroSolicitud.update({
        where: { id: solicitud.id },
        data: { estado: ReintegroEstado.PAGADO },
      });
      await this.addHistorial(
        tx,
        solicitud.id,
        solicitud.estado,
        ReintegroEstado.PAGADO,
        'Pagado',
      );
    });

    return {
      ok: true,
      estado: ReintegroEstado.PAGADO,
      comprobanteId: compReintegro.id,
      comprobanteNumero: compReintegro.numeroCompleto,
      pdfStorageKey: compReintegro.pdfStorageKey,
    };
  }

  async validar(
    organizacionId: string,
    body: {
      personaTipo?: 'TITULAR' | 'FAMILIAR';
      afiliadoId?: IdLike;
      familiarId?: IdLike;
      tipo?: 'MEDICAMENTO' | 'PRACTICA';
      fechaFactura?: string;
      importe?: number;
      items?: { descripcion: string; cantidad: number; importe: number; porcentaje?: number; tipoItem?: 'MEDICAMENTO' | 'PRACTICA' }[];
    },
  ) {
    if (!body?.personaTipo) throw new BadRequestException('personaTipo requerido');
    if (!body?.afiliadoId) throw new BadRequestException('afiliadoId requerido');
    if (body.personaTipo === 'FAMILIAR' && !body.familiarId)
      throw new BadRequestException('familiarId requerido');
    if (!body?.tipo) throw new BadRequestException('tipo requerido');

    const afId = await this.ensureAfiliadoInOrg(organizacionId, body.afiliadoId);
    if (body.personaTipo === 'FAMILIAR') await this.ensureFamiliar(afId, body.familiarId);

    const fechaFactura = this.parseFecha(body.fechaFactura);
    const politica = await this.getPolitica(organizacionId, fechaFactura);
    const maxOrdenesPorGrupo = politica?.maxOrdenesPorGrupo ?? 4;
    const maxMedicamentosPorOrden = politica?.maxMedicamentosPorOrden ?? 2;

    const cos = await this.prisma.coseguroAfiliado.findFirst({
      where: { organizacionId, afiliadoId: afId },
      select: { estado: true, suspendidoEn: true },
    });

    const motivos: string[] = [];
    if (!cos || cos.estado !== 'activo') motivos.push('COSEGURO_INACTIVO');
    if (cos?.suspendidoEn) motivos.push('COSEGURO_SUSPENDIDO');

    const { desde, hasta } = this.getYearRange(fechaFactura);
    const ordenesUsadas = await this.prisma.reintegroSolicitud.count({
      where: {
        organizacionId,
        afiliadoId: afId,
        estado: { in: this.estadosConsumenOrden() },
        fechaFactura: { gte: desde, lte: hasta },
      },
    });
    if (ordenesUsadas >= maxOrdenesPorGrupo) motivos.push('MAX_ORDENES_GRUPO');

    const items = body.items ?? [];
    const medsEnOrden = items.filter(
      (i) => (i.tipoItem ?? body.tipo) === 'MEDICAMENTO',
    ).length;
    if (medsEnOrden > maxMedicamentosPorOrden) motivos.push('MAX_MEDICAMENTOS_POR_ORDEN');

    const topesPrestaciones = (politica?.topesPrestaciones as any) ?? null;
    const opticaCfg = topesPrestaciones?.optica ?? null;
    let opticaUsadoAnual = false;
    if (opticaCfg && items.length > 0) {
      const prevItems = await this.prisma.reintegroItem.findMany({
        where: {
          solicitud: {
            organizacionId,
            afiliadoId: afId,
            estado: { in: this.estadosConsumenOrden() },
            fechaFactura: { gte: desde, lte: hasta },
          },
        },
        select: { descripcion: true },
      });
      const marcosUsados = this.countKeyword(prevItems, 'marco');
      const cristalesUsados = this.countKeyword(prevItems, 'cristal');
      const marcosReq = this.countKeyword(items, 'marco');
      const cristalesReq = this.countKeyword(items, 'cristal');
      const maxMarcos = Number(opticaCfg?.marcos ?? 1);
      const maxCristales = Number(opticaCfg?.cristales ?? 1);
      if (marcosUsados + marcosReq > maxMarcos || cristalesUsados + cristalesReq > maxCristales) {
        motivos.push('TOPE_OPTICA_ANUAL');
        opticaUsadoAnual = true;
      }
    }

    return {
      eligible: this.normalizeMotivos(motivos).length === 0,
      motivos: this.normalizeMotivos(motivos),
      topeDisponible: null,
      importeSugerido: body.importe ?? 0,
      consumos: {
        ordenesGrupoUsadas: ordenesUsadas,
        ordenesGrupoMax: maxOrdenesPorGrupo,
        medicamentosPorOrdenMax: maxMedicamentosPorOrden,
        opticaUsadoAnual,
      },
    };
  }

  async listarPoliticas(organizacionId: string, params: { activo?: boolean } = {}) {
    return this.prisma.reintegroPolitica.findMany({
      where: {
        organizacionId,
        ...(params.activo == null ? {} : { activo: params.activo }),
      },
      orderBy: [{ vigenteDesde: 'desc' }],
    });
  }

  async crearPolitica(
    organizacionId: string,
    body: {
      vigenteDesde?: string;
      vigenteHasta?: string | null;
      activo?: boolean;
      topeMensual?: number;
      topeAnual?: number;
      porcentajeMedicamento?: number;
      porcentajePractica?: number;
      diasVentanaPresentacion?: number;
      carenciaMeses?: number;
      maxOrdenesPorGrupo?: number;
      maxMedicamentosPorOrden?: number;
      topesPrestaciones?: Prisma.JsonValue;
      requisitosAdjuntos?: Prisma.JsonValue;
      exclusiones?: Prisma.JsonValue;
    },
  ) {
    if (!body?.vigenteDesde) throw new BadRequestException('vigenteDesde requerido');
    const desde = new Date(body.vigenteDesde);
    if (isNaN(desde.getTime())) throw new BadRequestException('vigenteDesde invalida');
    const hasta =
      body.vigenteHasta === '' || body.vigenteHasta == null ? null : new Date(body.vigenteHasta);
    if (hasta && isNaN(hasta.getTime())) throw new BadRequestException('vigenteHasta invalida');
    if (hasta && hasta < desde) throw new BadRequestException('vigenteHasta < vigenteDesde');

    return this.prisma.reintegroPolitica.create({
      data: {
        organizacionId,
        vigenteDesde: desde,
        vigenteHasta: hasta,
        activo: body.activo ?? true,
        topeMensual: body.topeMensual ?? null,
        topeAnual: body.topeAnual ?? null,
        porcentajeMedicamento: body.porcentajeMedicamento ?? null,
        porcentajePractica: body.porcentajePractica ?? null,
        diasVentanaPresentacion: body.diasVentanaPresentacion ?? null,
        carenciaMeses: body.carenciaMeses ?? null,
        maxOrdenesPorGrupo: body.maxOrdenesPorGrupo ?? null,
        maxMedicamentosPorOrden: body.maxMedicamentosPorOrden ?? null,
        topesPrestaciones: body.topesPrestaciones ?? Prisma.JsonNull,
        requisitosAdjuntos: body.requisitosAdjuntos ?? Prisma.JsonNull,
        exclusiones: body.exclusiones ?? Prisma.JsonNull,
      },
    });
  }

  async actualizarPolitica(
    organizacionId: string,
    id: string,
    body: {
      vigenteDesde?: string;
      vigenteHasta?: string | null;
      activo?: boolean;
      topeMensual?: number;
      topeAnual?: number;
      porcentajeMedicamento?: number;
      porcentajePractica?: number;
      diasVentanaPresentacion?: number;
      carenciaMeses?: number;
      maxOrdenesPorGrupo?: number;
      maxMedicamentosPorOrden?: number;
      topesPrestaciones?: Prisma.JsonValue;
      requisitosAdjuntos?: Prisma.JsonValue;
      exclusiones?: Prisma.JsonValue;
    },
  ) {
    const curr = await this.prisma.reintegroPolitica.findFirst({
      where: { organizacionId, id: BigInt(id) },
    });
    if (!curr) throw new NotFoundException('Politica no encontrada');

    let desde: Date | undefined;
    let hasta: Date | null | undefined;
    if (body.vigenteDesde || body.vigenteHasta !== undefined) {
      const baseDesde = body.vigenteDesde ?? curr.vigenteDesde.toISOString().slice(0, 10);
      const baseHasta =
        body.vigenteHasta ?? curr.vigenteHasta?.toISOString().slice(0, 10) ?? null;
      const d = new Date(baseDesde);
      if (isNaN(d.getTime())) throw new BadRequestException('vigenteDesde invalida');
      const h = baseHasta === '' || baseHasta == null ? null : new Date(baseHasta);
      if (h && isNaN(h.getTime())) throw new BadRequestException('vigenteHasta invalida');
      if (h && h < d) throw new BadRequestException('vigenteHasta < vigenteDesde');
      desde = d;
      hasta = h;
    }

    const data: Prisma.ReintegroPoliticaUpdateInput = {
      ...(body.vigenteDesde != null ? { vigenteDesde: desde } : {}),
      ...(body.vigenteHasta !== undefined ? { vigenteHasta: hasta ?? null } : {}),
      ...(body.activo != null ? { activo: body.activo } : {}),
      ...(body.topeMensual !== undefined ? { topeMensual: body.topeMensual ?? null } : {}),
      ...(body.topeAnual !== undefined ? { topeAnual: body.topeAnual ?? null } : {}),
      ...(body.porcentajeMedicamento !== undefined
        ? { porcentajeMedicamento: body.porcentajeMedicamento ?? null }
        : {}),
      ...(body.porcentajePractica !== undefined
        ? { porcentajePractica: body.porcentajePractica ?? null }
        : {}),
      ...(body.diasVentanaPresentacion !== undefined
        ? { diasVentanaPresentacion: body.diasVentanaPresentacion ?? null }
        : {}),
      ...(body.carenciaMeses !== undefined ? { carenciaMeses: body.carenciaMeses ?? null } : {}),
      ...(body.maxOrdenesPorGrupo !== undefined
        ? { maxOrdenesPorGrupo: body.maxOrdenesPorGrupo ?? null }
        : {}),
      ...(body.maxMedicamentosPorOrden !== undefined
        ? { maxMedicamentosPorOrden: body.maxMedicamentosPorOrden ?? null }
        : {}),
      ...(body.topesPrestaciones !== undefined
        ? { topesPrestaciones: body.topesPrestaciones ?? Prisma.JsonNull }
        : {}),
      ...(body.requisitosAdjuntos !== undefined
        ? { requisitosAdjuntos: body.requisitosAdjuntos ?? Prisma.JsonNull }
        : {}),
      ...(body.exclusiones !== undefined
        ? { exclusiones: body.exclusiones ?? Prisma.JsonNull }
        : {}),
    };

    return this.prisma.reintegroPolitica.update({
      where: { id: BigInt(id) },
      data,
    });
  }
}
