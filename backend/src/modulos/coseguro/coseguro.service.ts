import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NovedadesService } from '../novedades/novedades.service';

type IdLike = string | number | bigint;
const toBig = (v: IdLike) => {
  try {
    return typeof v === 'bigint' ? v : BigInt(v);
  } catch {
    throw new BadRequestException('Identificador inválido');
  }
};

@Injectable()
export class CoseguroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly novedades: NovedadesService,
  ) {}

  // ----------------- helpers -----------------
  private async ensureAfiliadoInOrg(organizacionId: string, afiliadoId: IdLike) {
    const id = toBig(afiliadoId);
    const ok = await this.prisma.afiliado.findFirst({
      where: { id, organizacionId },
      select: { id: true },
    });
    if (!ok) throw new NotFoundException('Afiliado no encontrado en la organización');
    return id;
  }

  private normalizeFecha(fecha?: string | Date | null): Date | undefined {
    if (!fecha) return undefined;
    if (fecha instanceof Date) return fecha;
    const d = new Date(fecha);
    if (isNaN(d.getTime())) throw new BadRequestException('Fecha inválida');
    return d;
  }

  private async reglaCoseguroVigente(organizacionId: string, at: Date) {
    return this.prisma.reglaPrecioCoseguro.findFirst({
      where: {
        organizacionId,
        activo: true,
        vigenteDesde: { lte: at },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: at } }],
      },
      orderBy: { vigenteDesde: 'desc' },
      select: { precioBase: true },
    });
  }

  /** Primer padrón activo del afiliado (política simple). */
  private async padronDestino(organizacionId: string, afiliadoId: bigint): Promise<bigint> {
    const p = await this.prisma.padron.findFirst({
      where: { organizacionId, afiliadoId, activo: true },
      orderBy: [{ id: 'asc' }],
      select: { id: true },
    });
    if (!p?.id) throw new NotFoundException('No hay padrón activo para imputar J22');
    return p.id;
  }

  private async listPadronesActivos(organizacionId: string, afiliadoId: bigint) {
    return this.prisma.padron.findMany({
      where: { organizacionId, afiliadoId, activo: true },
      select: { id: true, padron: true, activo: true, sistema: true, centro: true },
      orderBy: { id: 'asc' },
    });
  }

  // ----------------- lecturas -----------------

  /** Panel: afiliado + estado + padrones + precio base (J22). */
  async getCoseguroPanel(organizacionId: string, afiliadoId: IdLike) {
    const afId = await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);

    const [afiliado, coseguro, padrones, regla] = await Promise.all([
      this.prisma.afiliado.findFirst({
        where: { id: afId, organizacionId },
        select: { id: true, apellido: true, nombre: true, dni: true },
      }),
      this.prisma.coseguroAfiliado.findFirst({
        where: { organizacionId, afiliadoId: afId },
        select: {
          id: true,
          estado: true,
          fechaAlta: true,
          fechaBaja: true,
          imputacionPadronIdCoseguro: true,
        },
      }),
      this.listPadronesActivos(organizacionId, afId),
      this.reglaCoseguroVigente(organizacionId, new Date()),
    ]);

    const j22 = regla?.precioBase != null ? Number(regla.precioBase) : 0;

    const coseguroCfg = !coseguro
      ? null
      : {
          id: coseguro.id.toString(),
          estado: (coseguro.estado as 'activo' | 'baja') ?? 'baja',
          fechaAlta: coseguro.fechaAlta?.toISOString().slice(0, 10) ?? null,
          fechaBaja: coseguro.fechaBaja?.toISOString().slice(0, 10) ?? null,
          padronCoseguroId: coseguro.imputacionPadronIdCoseguro ?? null,
        };

    return {
      afiliado,
      coseguro: coseguroCfg,
      padrones,
      precioBase: j22, // sólo J22
    };
  }

  /** Precio base vigente (J22) para un afiliado y fecha. */
  async getPrecioBase(organizacionId: string, afiliadoId: IdLike, fecha?: string) {
    await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);
    const at = fecha ? this.normalizeFecha(fecha)! : new Date();
    const regla = await this.reglaCoseguroVigente(organizacionId, at);
    const j22 = regla?.precioBase != null ? Number(regla.precioBase) : 0;
    return { coseguro: j22 };
  }

  // ----------------- upsert + novedades (con control de reasignación) -----------------

  async upsertConfig(params: {
    organizacionId: string;
    afiliadoId: IdLike;
    estado: 'activo' | 'baja';
    padronCoseguroId: IdLike | null;
    ocurridoEn?: Date | string;
    reasignar?: boolean; // ⬅️ para confirmar reasignación de padrón
  }) {
    const { organizacionId, reasignar } = params;
    const afId = await this.ensureAfiliadoInOrg(organizacionId, params.afiliadoId);
    const fecha = params.ocurridoEn ? this.normalizeFecha(params.ocurridoEn)! : new Date();

    // validar padrón nuevo si viene
    const padronNuevo = params.padronCoseguroId != null ? toBig(params.padronCoseguroId) : null;
    if (padronNuevo != null) {
      const p = await this.prisma.padron.findFirst({
        where: { id: padronNuevo, afiliadoId: afId, organizacionId, activo: true },
        select: { id: true },
      });
      if (!p) throw new BadRequestException('Padrón inválido para imputación de J22');
    }

    // leer estado previo
    const previo = await this.prisma.coseguroAfiliado.findFirst({
      where: { organizacionId, afiliadoId: afId },
      select: {
        id: true,
        estado: true,
        fechaAlta: true,
        fechaBaja: true,
        imputacionPadronIdCoseguro: true,
      },
    });

    const estadoPrevio = (previo?.estado as 'activo' | 'baja' | undefined) ?? 'baja';
    const padronPrevio = previo?.imputacionPadronIdCoseguro ?? null;
    const quiereActivo = params.estado === 'activo';

    // si ya está activo y quiere activar en otro padrón → requiere reasignación
    const requiereReasignacion =
      quiereActivo &&
      estadoPrevio === 'activo' &&
      padronNuevo != null &&
      padronPrevio != null &&
      padronNuevo !== padronPrevio;

    if (requiereReasignacion && !reasignar) {
      throw new ConflictException({
        code: 'REQUIERE_REASIGNACION_J22',
        message: 'El afiliado ya tiene J22 activo imputado a otro padrón.',
        currentPadronId: padronPrevio.toString(),
        newPadronId: padronNuevo.toString(),
        suggest: 'Confirme enviando reasignar=true',
      });
    }

    // persistencia (fechaAlta NUNCA null)
    const actualizado = await this.prisma.$transaction(async (tx) => {
      if (!previo) {
        return tx.coseguroAfiliado.create({
          data: {
            organizacionId,
            afiliadoId: afId,
            estado: params.estado,
            fechaAlta: fecha, // requerido
            fechaBaja: params.estado === 'baja' ? fecha : null,
            imputacionPadronIdCoseguro: padronNuevo,
          },
          select: {
            id: true,
            estado: true,
            fechaAlta: true,
            fechaBaja: true,
            imputacionPadronIdCoseguro: true,
          },
        });
      } else {
        const data: any = {
          estado: params.estado,
          imputacionPadronIdCoseguro: padronNuevo ?? previo.imputacionPadronIdCoseguro,
        };
        if (params.estado === 'activo' && !previo.fechaAlta) data.fechaAlta = fecha;
        if (params.estado === 'baja') data.fechaBaja = fecha;

        return tx.coseguroAfiliado.update({
          where: { id: previo.id },
          data,
          select: {
            id: true,
            estado: true,
            fechaAlta: true,
            fechaBaja: true,
            imputacionPadronIdCoseguro: true,
          },
        });
      }
    });

    // novedades (fuera del tx)
    const estadoNuevo = actualizado.estado as 'activo' | 'baja';
    const padronFinal = actualizado.imputacionPadronIdCoseguro ?? null;

    const ensurePadron = async (p?: bigint | null) =>
      p != null ? p : await this.padronDestino(organizacionId, afId);

    // Alta / Baja simples
    if (estadoPrevio !== 'activo' && estadoNuevo === 'activo') {
      const p = await ensurePadron(padronFinal);
      await this.novedades.registrarAltaCoseguro({
        organizacionId,
        afiliadoId: afId,
        padronId: p,
        ocurridoEn: fecha,
        observacion: 'Alta coseguro (upsert)',
      });
    } else if (estadoPrevio === 'activo' && estadoNuevo !== 'activo') {
      const p = await ensurePadron(padronPrevio);
      await this.novedades.registrarBajaCoseguro({
        organizacionId,
        afiliadoId: afId,
        padronId: p,
        ocurridoEn: fecha,
        observacion: 'Baja coseguro (upsert)',
      });
    }

    // Reasignación (activo → activo con padrón distinto y reasignar=true)
    const reasigno =
      quiereActivo &&
      estadoPrevio === 'activo' &&
      padronPrevio != null &&
      padronFinal != null &&
      padronPrevio !== padronFinal;

    if (reasigno) {
      // 1) baja en padrón anterior (J22 = 0)
      await this.novedades.registrarBajaCoseguro({
        organizacionId,
        afiliadoId: afId,
        padronId: padronPrevio,
        ocurridoEn: fecha,
        observacion: 'Reasignación J22: baja en padrón anterior',
      });
      // 2) alta en padrón nuevo (J22 = precio vigente)
      await this.novedades.registrarAltaCoseguro({
        organizacionId,
        afiliadoId: afId,
        padronId: padronFinal,
        ocurridoEn: fecha,
        observacion: 'Reasignación J22: alta en padrón nuevo',
      });
    }

    return {
      estado: estadoNuevo,
      fechaAlta: actualizado.fechaAlta?.toISOString().slice(0, 10) ?? null,
      fechaBaja: actualizado.fechaBaja?.toISOString().slice(0, 10) ?? null,
      padronCoseguroId: padronFinal,
    };
  }

  // ----------------- acciones directas (opcionales) -----------------

  /** Alta directa de coseguro (J22). */
  async altaCoseguro(
    organizacionId: string,
    afiliadoId: IdLike,
    padronId: IdLike,
    ocurridoEn?: Date,
  ) {
    const afId = await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);
    const fecha = ocurridoEn ?? new Date();

    await this.prisma.$transaction(async (tx) => {
      const existente = await tx.coseguroAfiliado.findFirst({
        where: { organizacionId, afiliadoId: afId },
        select: { id: true, fechaAlta: true },
      });
      const data: any = {
        organizacionId,
        afiliadoId: afId,
        estado: 'activo',
        imputacionPadronIdCoseguro: toBig(padronId),
        fechaAlta: existente?.fechaAlta ?? fecha, // nunca null
      };
      if (!existente) {
        await tx.coseguroAfiliado.create({ data });
      } else {
        await tx.coseguroAfiliado.update({ where: { id: existente.id }, data });
      }
    });

    await this.novedades.registrarAltaCoseguro({
      organizacionId,
      afiliadoId: afId,
      padronId: toBig(padronId),
      ocurridoEn: fecha,
      observacion: 'Alta coseguro (directa)',
    });

    return { ok: true };
  }

  /** Baja directa de coseguro (J22=0). */
  async bajaCoseguro(organizacionId: string, afiliadoId: IdLike, ocurridoEn?: Date) {
    const afId = await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);
    const fecha = ocurridoEn ?? new Date();

    const cos = await this.prisma.coseguroAfiliado.findFirst({
      where: { organizacionId, afiliadoId: afId },
      select: { id: true, fechaAlta: true, imputacionPadronIdCoseguro: true },
    });

    await this.prisma.$transaction(async (tx) => {
      if (cos) {
        await tx.coseguroAfiliado.update({
          where: { id: cos.id },
          data: { estado: 'baja', fechaBaja: fecha },
        });
      } else {
        await tx.coseguroAfiliado.create({
          data: {
            organizacionId,
            afiliadoId: afId,
            estado: 'baja',
            fechaAlta: fecha, // requerido por el esquema
            fechaBaja: fecha,
            imputacionPadronIdCoseguro: null,
          },
        });
      }
    });

    const pad = cos?.imputacionPadronIdCoseguro ?? (await this.padronDestino(organizacionId, afId));

    await this.novedades.registrarBajaCoseguro({
      organizacionId,
      afiliadoId: afId,
      padronId: pad,
      ocurridoEn: fecha,
      observacion: 'Baja coseguro (directa)',
    });

    return { ok: true };
  }

  /** Modificación del precio base (J22) por regla (manual/administrativa). */
  async modificarPrecioCoseguro(
    organizacionId: string,
    afiliadoId: IdLike,
    padronId: IdLike,
    nuevoPrecio: string | number,
    ocurridoEn?: Date,
  ) {
    const afId = await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);

    await this.novedades.registrarModifCoseguro({
      organizacionId,
      afiliadoId: afId,
      padronId: toBig(padronId),
      nuevoPrecio,
      ocurridoEn: ocurridoEn ?? new Date(),
      observacion: 'Modificación precio coseguro (manual)',
    });

    return { ok: true };
  }
}
