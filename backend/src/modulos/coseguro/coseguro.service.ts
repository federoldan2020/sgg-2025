import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NovedadesPendientesService } from '../novedades/novedades-pendientes.service';

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
    private readonly novedadesPendientes: NovedadesPendientesService,
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

    // El modelo nuevo de novedades detecta deltas vs el último envío al
    // momento de generar el lote; ya no se registra cada cambio en buffer.
    // Las bajas explícitas se registran vía `BajaInformable` (TODO al codear
    // el nuevo módulo de novedades).
    const estadoNuevo = actualizado.estado as 'activo' | 'baja';
    const padronFinal = actualizado.imputacionPadronIdCoseguro ?? null;

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

    const regla = await this.reglaCoseguroVigente(organizacionId, fecha);
    const valorJ22 = regla ? Number(regla.precioBase) : null;

    await this.prisma.$transaction(async (tx) => {
      const existente = await tx.coseguroAfiliado.findFirst({
        where: { organizacionId, afiliadoId: afId },
        select: { id: true, fechaAlta: true, estado: true },
      });
      const yaActivo = existente?.estado === 'activo';
      const data: any = {
        organizacionId,
        afiliadoId: afId,
        estado: 'activo',
        // Limpiar origenBaja: si venía de una baja previa (manual o auto),
        // el alta lo resetea.
        origenBaja: null,
        imputacionPadronIdCoseguro: toBig(padronId),
        fechaAlta: existente?.fechaAlta ?? fecha,
      };
      if (!existente) {
        await tx.coseguroAfiliado.create({ data });
      } else {
        await tx.coseguroAfiliado.update({ where: { id: existente.id }, data });
      }

      // Si ya estaba activo no emitimos novedad (no hay delta para Cómputos).
      // Si arrancó / se reactivó, encolamos ALTA J22 al lote del mes corriente.
      if (!yaActivo) {
        if (valorJ22 == null || valorJ22 <= 0) {
          throw new BadRequestException(
            'No hay ReglaPrecioCoseguro vigente: cargá una regla activa antes de dar de alta el coseguro.',
          );
        }
        await this.novedadesPendientes.crear(
          {
            organizacionId,
            padronId: toBig(padronId),
            afiliadoId: afId,
            concepto: 'J22',
            tipoMovimiento: 'alta',
            destino: 'COMPUTOS',
            valor: valorJ22,
            origenEvento: 'hook_coseguro_alta',
          },
          tx,
        );
      }
    });

    return { ok: true };
  }

  /**
   * Baja directa de coseguro (J22=0).
   * `origenBaja`:
   *   - "manual_operador" (default) → baja desde la ficha del afiliado.
   *   - "auto_3m_sin_j22"  → job de baja automática (3 meses sin cobranza).
   *   - "padron_inactivo"  → cascada por baja del padrón imputado.
   * Solo "auto_3m_sin_j22" se reactiva sola cuando el afiliado salda la deuda.
   */
  async bajaCoseguro(
    organizacionId: string,
    afiliadoId: IdLike,
    ocurridoEn?: Date,
    origenBaja: 'manual_operador' | 'auto_3m_sin_j22' | 'padron_inactivo' = 'manual_operador',
  ) {
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
          data: { estado: 'baja', fechaBaja: fecha, origenBaja },
        });
      } else {
        await tx.coseguroAfiliado.create({
          data: {
            organizacionId,
            afiliadoId: afId,
            estado: 'baja',
            origenBaja,
            fechaAlta: fecha,
            fechaBaja: fecha,
            imputacionPadronIdCoseguro: null,
          },
        });
      }

      // Solo informamos baja si efectivamente estaba imputado a un padrón
      // (caso contrario Cómputos nunca lo conoció).
      if (cos?.imputacionPadronIdCoseguro) {
        await this.novedadesPendientes.crear(
          {
            organizacionId,
            padronId: cos.imputacionPadronIdCoseguro,
            afiliadoId: afId,
            concepto: 'J22',
            tipoMovimiento: 'baja',
            destino: 'COMPUTOS',
            origenEvento: 'hook_coseguro_baja',
          },
          tx,
        );
      }
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
    await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);
    // Modificación queda implícita por el cambio en la regla vigente;
    // el módulo nuevo de novedades enviará el nuevo precio en el próximo
    // lote (delta vs último envío).
    void padronId;
    void nuevoPrecio;
    void ocurridoEn;
    return { ok: true };
  }

  /**
   * @deprecated en modelo nuevo el "coseguro suspendido" se evalúa
   * dinámicamente vía `GateService.puedeUsarCoseguro` (J22 cubierto del mes
   * corriente + sin deuda histórica J22). Esta función queda como compatibilidad:
   * pasa el coseguro a estado='baja' con la fecha indicada. La novedad de
   * baja a Cómputos se materializa vía `BajaInformable`.
   */
  async suspenderCoseguro(
    organizacionId: string,
    afiliadoId: IdLike,
    _motivo?: string,
    _suspendidoPorId?: string,
    ocurridoEn?: Date,
  ) {
    const afId = await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);
    const fecha = ocurridoEn ?? new Date();
    await this.prisma.coseguroAfiliado.updateMany({
      where: { organizacionId, afiliadoId: afId },
      data: { estado: 'baja', fechaBaja: fecha },
    });
    return { ok: true };
  }

  /** @deprecated reactivar coseguro: pasa a estado='activo'. */
  async rehabilitarCoseguro(
    organizacionId: string,
    afiliadoId: IdLike,
    _ocurridoEn?: Date,
  ) {
    const afId = await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);
    await this.prisma.coseguroAfiliado.updateMany({
      where: { organizacionId, afiliadoId: afId },
      data: { estado: 'activo', fechaBaja: null },
    });
    return { ok: true };
  }
}
