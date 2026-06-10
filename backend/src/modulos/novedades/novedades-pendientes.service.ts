import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

/**
 * Cola operator-driven de novedades J17/J22/J38 que se vuelcan al lote
 * mensual. Reemplaza el modelo "snapshot del estado vigente".
 *
 * Reglas:
 *  - destino COMPUTOS  → concepto en (J17, J22, J38).
 *  - destino ANSES     → concepto debe ser J17.
 *  - alta / modificacion → valor obligatorio (> 0).
 *  - baja                → valor = null.
 *  - No se permite > 1 pendiente del mismo (padron, concepto, periodoObjetivo)
 *    en estado "pendiente" (idempotencia desde hooks).
 */

export type ConceptoNov = 'J17' | 'J22' | 'J38';
export type TipoMovimientoNov = 'alta' | 'baja' | 'modificacion';
export type DestinoNov = 'COMPUTOS' | 'ANSES';
export type EstadoNov = 'pendiente' | 'enviada' | 'cancelada';

export type OrigenEvento =
  | 'hook_coseguro_alta'
  | 'hook_coseguro_baja'
  | 'hook_colaterales_alta'
  | 'hook_colaterales_baja'
  | 'hook_afiliado_alta'
  | 'hook_afiliado_baja'
  | 'manual_operador';

export type CrearPendienteInput = {
  organizacionId: string;
  padronId: bigint;
  afiliadoId: bigint;
  concepto: ConceptoNov;
  tipoMovimiento: TipoMovimientoNov;
  destino: DestinoNov;
  valor?: number | null;
  /**
   * YYYY-MM al que debe ir la novedad. **Opcional desde hooks**: si no se pasa,
   * se resuelve dinámicamente vía `resolverPeriodoObjetivo()` (mes corriente
   * si el lote sigue abierto, mes siguiente si ya fue enviado). Obligatorio
   * desde alta manual (el operador decide).
   */
  periodoObjetivo?: string;
  origenEvento: OrigenEvento;
  observacion?: string;
  creadoPorId?: string;
};

/** Período YYYY-MM (UTC) corriente. */
function periodoActual(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Mes siguiente a YYYY-MM. */
function periodoSiguiente(p: string): string {
  const [y, m] = p.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1)); // mes siguiente
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Estados de lote en los que TODAVÍA está "abierto" para recibir pendientes. */
const ESTADOS_LOTE_ABIERTO = new Set<string>(['borrador']);

/** Acepta un PrismaClient o una transacción interactiva. */
type DbCtx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class NovedadesPendientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ─────────────────────────────────────────────────────────────────
  // Creación (desde hooks o manual)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Crea una pendiente. Si el caller está dentro de una transacción puede
   * pasar `tx` para que la inserción participe.
   *
   * Idempotencia: si ya hay una pendiente con mismo (padron, concepto,
   * periodoObjetivo, estado=pendiente), la actualiza en lugar de duplicar.
   * Esto evita que dos eventos consecutivos (ej: alta + baja + alta mismo día)
   * dejen registros redundantes.
   */
  async crear(input: CrearPendienteInput, tx?: Prisma.TransactionClient) {
    const db: DbCtx = tx ?? this.prisma;

    // Resolver período objetivo si no vino dado (caso típico desde hooks).
    const periodoObjetivo =
      input.periodoObjetivo ??
      (await this.resolverPeriodoObjetivo(input.organizacionId, input.destino, db));

    this.validar({ ...input, periodoObjetivo });

    const existente = await db.novedadPendiente.findFirst({
      where: {
        organizacionId: input.organizacionId,
        padronId: input.padronId,
        concepto: input.concepto,
        periodoObjetivo,
        estado: 'pendiente',
      },
      select: { id: true },
    });

    const data = {
      organizacionId: input.organizacionId,
      padronId: input.padronId,
      afiliadoId: input.afiliadoId,
      concepto: input.concepto,
      tipoMovimiento: input.tipoMovimiento,
      destino: input.destino,
      valor:
        input.valor != null && input.tipoMovimiento !== 'baja'
          ? new Prisma.Decimal(input.valor)
          : null,
      periodoObjetivo,
      origenEvento: input.origenEvento,
      observacion: input.observacion ?? null,
      creadoPorId: input.creadoPorId ?? null,
    };

    if (existente) {
      return db.novedadPendiente.update({
        where: { id: existente.id },
        data,
      });
    }
    return db.novedadPendiente.create({ data });
  }

  // ─────────────────────────────────────────────────────────────────
  // Listado / consulta
  // ─────────────────────────────────────────────────────────────────

  async listar(
    organizacionId: string,
    filtros: {
      estado?: EstadoNov;
      destino?: DestinoNov;
      concepto?: ConceptoNov;
      periodoObjetivo?: string;
      padronId?: bigint;
      afiliadoId?: bigint;
      take?: number;
      skip?: number;
    } = {},
  ) {
    const where: Prisma.NovedadPendienteWhereInput = {
      organizacionId,
      estado: filtros.estado,
      destino: filtros.destino,
      concepto: filtros.concepto,
      periodoObjetivo: filtros.periodoObjetivo,
      padronId: filtros.padronId,
      afiliadoId: filtros.afiliadoId,
    };
    const [items, total] = await Promise.all([
      this.prisma.novedadPendiente.findMany({
        where,
        orderBy: [{ creadoEn: 'desc' }],
        take: filtros.take ?? 200,
        skip: filtros.skip ?? 0,
        include: {
          padron: { select: { padron: true, centro: true, sistema: true } },
          afiliado: {
            select: { apellido: true, nombre: true, dni: true },
          },
        },
      }),
      this.prisma.novedadPendiente.count({ where }),
    ]);
    return { items, total };
  }

  async detalle(organizacionId: string, id: bigint) {
    const p = await this.prisma.novedadPendiente.findFirst({
      where: { id, organizacionId },
      include: {
        padron: { select: { padron: true, centro: true, sistema: true } },
        afiliado: { select: { apellido: true, nombre: true, dni: true } },
        lote: { select: { id: true, periodo: true, canal: true, estado: true } },
      },
    });
    if (!p) throw new NotFoundException('Novedad pendiente no encontrada');
    return p;
  }

  // ─────────────────────────────────────────────────────────────────
  // Cancelar
  // ─────────────────────────────────────────────────────────────────

  async cancelar(
    organizacionId: string,
    id: bigint,
    motivo: string,
    usuarioId?: string,
  ) {
    const p = await this.prisma.novedadPendiente.findFirst({
      where: { id, organizacionId },
      select: { id: true, estado: true, padronId: true, concepto: true },
    });
    if (!p) throw new NotFoundException('Novedad pendiente no encontrada');
    if (p.estado !== 'pendiente') {
      throw new BadRequestException(
        `No se puede cancelar: la novedad está en estado "${p.estado}"`,
      );
    }
    const updated = await this.prisma.novedadPendiente.update({
      where: { id },
      data: {
        estado: 'cancelada',
        canceladaEn: new Date(),
        canceladaPorId: usuarioId ?? null,
        motivoCancelacion: motivo,
      },
    });
    await this.audit.log({
      organizacionId,
      usuarioId,
      accion: 'NOVEDAD_PENDIENTE_CANCELAR',
      entidad: 'NovedadPendiente',
      entidadId: id.toString(),
      metadata: { motivo, padronId: p.padronId.toString(), concepto: p.concepto },
    });
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────
  // Cierre de lote (lo invoca NovedadesService al confirmar envío)
  // ─────────────────────────────────────────────────────────────────

  async marcarEnviadasEnLote(
    organizacionId: string,
    pendientesIds: bigint[],
    loteId: bigint,
    tx?: Prisma.TransactionClient,
  ) {
    if (pendientesIds.length === 0) return { count: 0 };
    const db: DbCtx = tx ?? this.prisma;
    return db.novedadPendiente.updateMany({
      where: { id: { in: pendientesIds }, organizacionId, estado: 'pendiente' },
      data: {
        estado: 'enviada',
        loteId,
        enviadaEn: new Date(),
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Resolución dinámica de período
  // ─────────────────────────────────────────────────────────────────

  /**
   * Devuelve el período YYYY-MM al que debe ir una nueva pendiente:
   *  - Mes corriente si no hay lote del destino para ese mes, o si el lote
   *    sigue en estado "borrador".
   *  - Mes siguiente si el lote del mes corriente ya fue cerrado (enviado /
   *    conciliado / parcialmente_conciliado). El cierre NO es un día fijo,
   *    lo decide el operador al marcar el lote como "enviado".
   */
  async resolverPeriodoObjetivo(
    organizacionId: string,
    destino: DestinoNov,
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const db: DbCtx = tx ?? this.prisma;
    const canal = destino === 'ANSES' ? 'ANSES' : 'ESC';
    const periodoHoy = periodoActual();

    const loteActual = await db.novedadLote.findFirst({
      where: {
        organizacionId,
        canal,
        periodo: periodoHoy,
        estado: { not: 'anulado' },
      },
      orderBy: { generadoEn: 'desc' },
      select: { estado: true },
    });

    if (!loteActual) return periodoHoy;
    if (ESTADOS_LOTE_ABIERTO.has(loteActual.estado)) return periodoHoy;
    return periodoSiguiente(periodoHoy);
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  private validar(input: CrearPendienteInput) {
    if (!input.periodoObjetivo || !/^\d{4}-\d{2}$/.test(input.periodoObjetivo)) {
      throw new BadRequestException(
        `periodoObjetivo inválido: "${input.periodoObjetivo}" (esperado YYYY-MM)`,
      );
    }
    if (input.destino === 'ANSES' && input.concepto !== 'J17') {
      throw new BadRequestException(
        `Destino ANSES sólo admite concepto J17 (recibido: ${input.concepto})`,
      );
    }
    if (input.tipoMovimiento !== 'baja') {
      if (input.valor == null || input.valor <= 0) {
        throw new BadRequestException(
          `Para ${input.tipoMovimiento} se requiere "valor" > 0`,
        );
      }
    }
  }
}
