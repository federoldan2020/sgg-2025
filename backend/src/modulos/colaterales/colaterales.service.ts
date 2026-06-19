import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ColateralesCalculoService } from './colaterales-calculo.service';
import { NovedadesPendientesService } from '../novedades/novedades-pendientes.service';
import { DossanjuanSyncService } from '../dossanjuan/dossanjuan-sync.service';
import { parsePage, type PageQuery } from '../../common/pagination.util';
import type { Prisma } from '@prisma/client';

type IdLike = string | number | bigint;
const toBig = (v: IdLike) => {
  try {
    return typeof v === 'bigint' ? v : BigInt(v);
  } catch {
    throw new BadRequestException('Identificador inválido');
  }
};

export type CreateColateralDto = {
  parentescoId: IdLike;
  nombre: string;
  dni: string;
  fechaNacimiento?: string | null;
  activo?: boolean; // default true
  esColateral?: boolean; // default true
  coseguroId?: IdLike; // opcional
};
export type UpdateColateralDto = Partial<CreateColateralDto> & { esColateral?: boolean };

@Injectable()
export class ColateralesService {
  private readonly logger = new Logger(ColateralesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calc: ColateralesCalculoService,
    private readonly novedadesPendientes: NovedadesPendientesService,
    private readonly dossanjuanSync: DossanjuanSyncService,
  ) {}

  // ----------------- sync dossanjuan -----------------

  /**
   * Encola sync con dossanjuan para un integrante del grupo familiar.
   *
   * Best-effort: si el DNI está vacío o inválido, se skipea silenciosamente
   * (no se puede identificar a la persona en dossanjuan sin DNI). Si el
   * titular no tiene coseguro activo, también se omite el ALTA — el
   * integrante no puede estar como UDAP si el titular no lo está.
   *
   * NOTA: la idempotencia la maneja el sync service (consulta el estado
   * remoto antes de cada escritura), así que es seguro encolar de más.
   */
  private async sincronizarIntegrante(
    organizacionId: string,
    afiliadoTitularId: bigint,
    dniIntegrante: string | null | undefined,
    accion: 'ALTA' | 'BAJA',
  ): Promise<void> {
    try {
      const limpio = (dniIntegrante ?? '').replace(/\D+/g, '');
      if (!limpio) return;
      let dniBig: bigint;
      try {
        dniBig = BigInt(limpio);
      } catch {
        return;
      }
      if (dniBig <= 0n) return;

      // Para ALTA, exigimos que el titular tenga coseguro activo. Para BAJA
      // siempre encolamos (mejor que quede sin cobertura aunque el titular
      // ya esté bajo).
      if (accion === 'ALTA') {
        const cos = await this.prisma.coseguroAfiliado.findFirst({
          where: { organizacionId, afiliadoId: afiliadoTitularId },
          select: { id: true, estado: true },
        });
        if (cos?.estado !== 'activo') return;
        this.dossanjuanSync.encolarAlta(organizacionId, cos.id, dniBig);
      } else {
        const cos = await this.prisma.coseguroAfiliado.findFirst({
          where: { organizacionId, afiliadoId: afiliadoTitularId },
          select: { id: true },
        });
        this.dossanjuanSync.encolarBaja(organizacionId, cos?.id ?? null, dniBig);
      }
    } catch (e: unknown) {
      this.logger.warn(
        `Sync dossanjuan ${accion} integrante dni=${dniIntegrante ?? '?'} falló: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

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
    if (isNaN(d.getTime())) throw new BadRequestException('fechaNacimiento inválida');
    return d;
  }

  // ----------------- lecturas -----------------
  async listParentescos(organizacionId: string) {
    const rows = await this.prisma.parentesco.findMany({
      where: { organizacionId, activo: true },
      orderBy: [{ codigo: 'asc' }, { id: 'asc' }],
      select: { id: true, codigo: true, descripcion: true },
    });
    return rows.map((r) => ({ id: r.id, codigo: r.codigo, nombre: r.descripcion }));
  }

  async listColaterales(organizacionId: string, afiliadoId: IdLike, soloActivos = true) {
    const afId = await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);
    return this.prisma.colateral.findMany({
      where: { afiliadoId: afId, ...(soloActivos ? { activo: true } : {}) },
      include: { parentesco: true, coseguro: true },
      orderBy: { id: 'desc' },
    });
  }

  async listColateralesPaged(
    organizacionId: string,
    params: PageQuery & {
      q?: string;
      estado?: 'activos' | 'baja' | 'todos';
      esColateral?: 'true' | 'false' | 'todos';
    },
  ) {
    const { skip, take, page, limit } = parsePage(params);
    const q = params.q?.trim();
    const estado = params.estado ?? 'todos';
    const esColateral = params.esColateral ?? 'todos';

    const afiliadoFilter: Prisma.AfiliadoWhereInput = { organizacionId };

    const where: Prisma.ColateralWhereInput = {
      afiliado: afiliadoFilter,
      ...(estado === 'activos' ? { activo: true } : {}),
      ...(estado === 'baja' ? { activo: false } : {}),
      ...(esColateral === 'true' ? { esColateral: true } : {}),
      ...(esColateral === 'false' ? { esColateral: false } : {}),
    };

    if (q) {
      const padronNormalizado = q.replace(/\s+/g, '').replace(/-/g, '');
      const padronMatch = padronNormalizado.match(/^(\d{6})(\d{1})$/);
      const dniNumber = Number.isFinite(Number(q)) ? BigInt(q) : null;

      const titularOr: Prisma.AfiliadoWhereInput[] = [
        { apellido: { contains: q, mode: 'insensitive' } },
        { nombre: { contains: q, mode: 'insensitive' } },
        ...(dniNumber !== null ? [{ dni: dniNumber }] : []),
      ];
      if (padronMatch) {
        const padronFormateado = `${padronMatch[1]}-${padronMatch[2]}`;
        titularOr.push({ padrones: { some: { padron: padronFormateado } } });
      }

      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { dni: { contains: q, mode: 'insensitive' } },
        { afiliado: { organizacionId, OR: titularOr } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.colateral.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'desc' },
        include: {
          parentesco: true,
          afiliado: {
            select: { id: true, dni: true, apellido: true, nombre: true, estado: true },
          },
        },
      }),
      this.prisma.colateral.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // ----------------- precio/preview -----------------
  async getPrecio(organizacionId: string, afiliadoId: IdLike, fecha?: string) {
    const afId = await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);
    const at = fecha ? new Date(fecha) : new Date();

    // J22 (coseguro base)
    let j22 = 0;
    const cos = await this.prisma.coseguroAfiliado.findFirst({
      where: { organizacionId, afiliadoId: afId },
      select: { estado: true },
    });
    if (cos?.estado === 'activo') {
      const r22 = await this.prisma.reglaPrecioCoseguro.findFirst({
        where: {
          organizacionId,
          activo: true,
          vigenteDesde: { lte: at },
          OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: at } }],
        },
        orderBy: { vigenteDesde: 'desc' },
        select: { precioBase: true },
      });
      if (r22?.precioBase != null) j22 = Number(r22.precioBase);
    }

    // J38 (colaterales)
    const j38 =
      cos?.estado === 'activo'
        ? Number(await this.calc.calcularTotalJ38(organizacionId, afId, at))
        : 0;

    return { coseguro: j22, colaterales: j38, total: j22 + j38 };
  }

  /**
   * Detecta el delta de J38 vs el total previo y encola una NovedadPendiente:
   *   - 0  → >0  : ALTA J38 (valor = total nuevo)
   *   - >0 → 0   : BAJA J38
   *   - >0 → >0  : MODIFICACION J38 (valor = total nuevo) sólo si cambió el monto
   *   - 0  → 0   : no-op
   * Requiere que el afiliado tenga `imputacionPadronIdColaterales` seteado.
   * Si no hay padrón imputado se loggea y se omite (Cómputos no lo conoce).
   */
  private async afterChangeRecalcularYNotificar(
    organizacionId: string,
    afiliadoId: bigint,
    fecha: Date,
    totalAntes: unknown,
    observacionAlta: string,
    observacionBaja: string,
    observacionModif: string,
  ): Promise<void> {
    try {
      const antes = Number(totalAntes ?? 0) || 0;
      const despues = Number(
        await this.calc.calcularTotalJ38(organizacionId, afiliadoId, fecha),
      ) || 0;

      const subio = antes === 0 && despues > 0;
      const bajo = antes > 0 && despues === 0;
      const modif = antes > 0 && despues > 0 && Math.abs(antes - despues) > 0.001;

      if (!subio && !bajo && !modif) return;

      const cos = await this.prisma.coseguroAfiliado.findFirst({
        where: { organizacionId, afiliadoId },
        select: { imputacionPadronIdColaterales: true },
      });
      const padronId = cos?.imputacionPadronIdColaterales ?? null;
      if (!padronId) {
        this.logger.warn(
          `J38 cambió (${antes}→${despues}) para afiliado ${afiliadoId} pero no tiene imputacionPadronIdColaterales; novedad omitida.`,
        );
        return;
      }

      if (subio) {
        await this.novedadesPendientes.crear({
          organizacionId,
          padronId,
          afiliadoId,
          concepto: 'J38',
          tipoMovimiento: 'alta',
          destino: 'COMPUTOS',
          valor: despues,
          origenEvento: 'hook_colaterales_alta',
          observacion: observacionAlta,
        });
      } else if (bajo) {
        await this.novedadesPendientes.crear({
          organizacionId,
          padronId,
          afiliadoId,
          concepto: 'J38',
          tipoMovimiento: 'baja',
          destino: 'COMPUTOS',
          origenEvento: 'hook_colaterales_baja',
          observacion: observacionBaja,
        });
      } else if (modif) {
        await this.novedadesPendientes.crear({
          organizacionId,
          padronId,
          afiliadoId,
          concepto: 'J38',
          tipoMovimiento: 'modificacion',
          destino: 'COMPUTOS',
          valor: despues,
          origenEvento: 'hook_colaterales_alta',
          observacion: observacionModif,
        });
      }
    } catch (err) {
      this.logger.error(
        `Fallo emitiendo NovedadPendiente J38 para afiliado ${afiliadoId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // ----------------- mutaciones (disparan J38) -----------------
  async createColateral(organizacionId: string, afiliadoId: IdLike, dto: CreateColateralDto) {
    const afId = await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);
    const fecha = new Date();

    // DNI único por afiliado
    if (dto.dni?.trim()) {
      const exists = await this.prisma.colateral.findFirst({
        where: { afiliadoId: afId, dni: dto.dni.trim() },
        select: { id: true },
      });
      if (exists)
        throw new ConflictException('Ya existe un integrante con ese DNI en el grupo del afiliado');
    }

    // totalAntes fuera del tx
    const totalAntes = await this.calc.calcularTotalJ38(organizacionId, afId, fecha);

    // mutación en tx
    const creado = await this.prisma.$transaction(async (tx) => {
      const row = await tx.colateral.create({
        data: {
          afiliadoId: afId,
          parentescoId: toBig(dto.parentescoId),
          nombre: dto.nombre.trim(),
          dni: dto.dni?.trim() || null,
          fechaNacimiento: this.normalizeFecha(dto.fechaNacimiento) ?? null,
          activo: dto.activo ?? true,
          esColateral: dto.esColateral ?? true,
          ...(dto.coseguroId ? { coseguroId: toBig(dto.coseguroId) } : {}),
        },
        select: { id: true },
      });
      return row;
    });

    // novedades después del commit
    await this.afterChangeRecalcularYNotificar(
      organizacionId,
      afId,
      fecha,
      totalAntes,
      `Alta colateral id=${creado.id}`,
      'Baja colaterales',
      `Modif total por alta colateral id=${creado.id}`,
    );

    // Sync dossanjuan: si el integrante quedó activo y tiene DNI, encolamos
    // ALTA (la verificación de coseguro activo del titular la hace el helper).
    const quedaActivo = dto.activo ?? true;
    if (quedaActivo) {
      await this.sincronizarIntegrante(organizacionId, afId, dto.dni, 'ALTA');
    }

    return { id: creado.id };
  }

  async updateColateral(
    organizacionId: string,
    afiliadoId: IdLike,
    colateralId: IdLike,
    dto: UpdateColateralDto,
  ) {
    const afId = await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);
    const colId = toBig(colateralId);
    const fecha = new Date();

    const actual = await this.prisma.colateral.findFirst({
      where: { id: colId, afiliadoId: afId },
      select: { id: true, dni: true, activo: true },
    });
    if (!actual) throw new NotFoundException('Colateral no encontrado');

    if (dto.dni?.trim()) {
      const dup = await this.prisma.colateral.findFirst({
        where: { afiliadoId: afId, dni: dto.dni.trim(), NOT: { id: colId } },
        select: { id: true },
      });
      if (dup)
        throw new ConflictException('Ya existe un integrante con ese DNI en el grupo del afiliado');
    }

    const totalAntes = await this.calc.calcularTotalJ38(organizacionId, afId, fecha);

    await this.prisma.$transaction(async (tx) => {
      await tx.colateral.update({
        where: { id: colId },
        data: {
          ...(dto.parentescoId != null ? { parentescoId: toBig(dto.parentescoId) } : {}),
          ...(dto.nombre != null ? { nombre: dto.nombre.trim() } : {}),
          ...(dto.dni != null ? { dni: dto.dni?.trim() || null } : {}),
          ...(dto.fechaNacimiento != null
            ? { fechaNacimiento: this.normalizeFecha(dto.fechaNacimiento) ?? null }
            : {}),
          ...(dto.activo != null ? { activo: dto.activo } : {}),
          ...(dto.esColateral != null ? { esColateral: dto.esColateral } : {}),
          ...(dto.coseguroId !== undefined
            ? dto.coseguroId
              ? { coseguroId: toBig(dto.coseguroId) }
              : { coseguroId: null }
            : {}),
        },
      });
    });

    await this.afterChangeRecalcularYNotificar(
      organizacionId,
      afId,
      fecha,
      totalAntes,
      `Alta por edición colateral id=${colId}`,
      `Baja por edición colateral id=${colId}`,
      `Modif por edición colateral id=${colId}`,
    );

    // Sync dossanjuan:
    //   - cambió `activo`: false → true ⇒ ALTA; true → false ⇒ BAJA.
    //   - cambió `dni`: dar de BAJA al DNI viejo y de ALTA al nuevo
    //     (si el integrante queda activo).
    const activoAhora = dto.activo ?? actual.activo;
    const dniAhora = dto.dni !== undefined ? dto.dni?.trim() || null : actual.dni;
    const dniCambio = dto.dni !== undefined && (actual.dni ?? '') !== (dniAhora ?? '');

    if (dniCambio && actual.dni) {
      await this.sincronizarIntegrante(organizacionId, afId, actual.dni, 'BAJA');
    }
    if (dto.activo !== undefined && actual.activo !== activoAhora) {
      const accion: 'ALTA' | 'BAJA' = activoAhora ? 'ALTA' : 'BAJA';
      await this.sincronizarIntegrante(organizacionId, afId, dniAhora, accion);
    } else if (dniCambio && activoAhora) {
      // Solo cambió el DNI y sigue activo → ALTA del nuevo
      await this.sincronizarIntegrante(organizacionId, afId, dniAhora, 'ALTA');
    }

    return { ok: true };
  }

  async removeColateral(
    organizacionId: string,
    afiliadoId: IdLike,
    colateralId: IdLike,
    options?: { hard?: boolean },
  ) {
    const afId = await this.ensureAfiliadoInOrg(organizacionId, afiliadoId);
    const colId = toBig(colateralId);
    const fecha = new Date();

    // Capturar DNI antes de borrar/desactivar para poder dar BAJA en dossanjuan.
    const previo = await this.prisma.colateral.findFirst({
      where: { id: colId, afiliadoId: afId },
      select: { dni: true, activo: true },
    });

    const totalAntes = await this.calc.calcularTotalJ38(organizacionId, afId, fecha);

    await this.prisma.$transaction(async (tx) => {
      if (options?.hard) {
        await tx.colateral.delete({ where: { id: colId } });
      } else {
        await tx.colateral.update({ where: { id: colId }, data: { activo: false } });
      }
    });

    await this.afterChangeRecalcularYNotificar(
      organizacionId,
      afId,
      fecha,
      totalAntes,
      'Alta colaterales',
      options?.hard ? 'Baja dura colateral' : 'Baja colateral',
      'Modif total por baja colateral',
    );

    // Si el integrante estaba activo (y por ende posiblemente como UDAP en
    // dossanjuan), encolamos BAJA. El sync service maneja idempotencia.
    if (previo?.dni && previo.activo) {
      await this.sincronizarIntegrante(organizacionId, afId, previo.dni, 'BAJA');
    }

    return { ok: true };
  }

  // ----------------- imputación J38 -----------------
  async getImputacionColaterales(organizacionId: string, afiliadoId: string | number | bigint) {
    const afId = BigInt(afiliadoId);
    const cos = await this.prisma.coseguroAfiliado.findFirst({
      where: { organizacionId, afiliadoId: afId },
      select: { imputacionPadronIdColaterales: true },
    });
    return { padronColatId: cos?.imputacionPadronIdColaterales ?? null };
  }

  async setImputacionColaterales(
    organizacionId: string,
    afiliadoId: string | number | bigint,
    padronId: string | number | bigint,
  ) {
    const afId = BigInt(afiliadoId);
    const pId = BigInt(padronId);
    const ahora = new Date();

    // 1) Validaciones básicas
    // - Afiliado pertenece a la org (reutilizá tu helper si querés)
    const afiliado = await this.prisma.afiliado.findFirst({
      where: { id: afId, organizacionId },
      select: { id: true },
    });
    if (!afiliado) throw new BadRequestException('Afiliado no encontrado en la organización');

    // - Padrón válido/activo para ese afiliado y org
    const pad = await this.prisma.padron.findFirst({
      where: { id: pId, afiliadoId: afId, organizacionId, activo: true },
      select: { id: true },
    });
    if (!pad) throw new BadRequestException('Padrón inválido para imputación');

    // 2) Leemos el registro de coseguro y total J38 actual
    const existente = await this.prisma.coseguroAfiliado.findFirst({
      where: { afiliadoId: afId, organizacionId },
      select: { id: true, estado: true, fechaAlta: true, imputacionPadronIdColaterales: true },
    });

    // total J38 vigente (lo usamos para novedades de cambio de imputación)
    const totalJ38 = await this.calc.calcularTotalJ38(organizacionId, afId, ahora);

    // 3) Persistencia en transacción (aseguramos consistencia)
    const { previoPadronId, nuevoPadronId, estadoFinal } = await this.prisma.$transaction(
      async (tx) => {
        let prevPadron: bigint | null = null;
        let nuevoPadron: bigint | null = null;
        let estado: 'activo' | 'baja' = 'baja';

        if (existente) {
          prevPadron = existente.imputacionPadronIdColaterales ?? null;

          // No forzamos estado aquí; sólo cambiamos imputación J38
          const upd = await tx.coseguroAfiliado.update({
            where: { id: existente.id },
            data: {
              imputacionPadronIdColaterales: pId,
              // fechaAlta se respeta; si no tuviera (caso raro), garantizamos una
              ...(existente.fechaAlta ? {} : { fechaAlta: ahora }),
            },
            select: { imputacionPadronIdColaterales: true, estado: true },
          });

          nuevoPadron = upd.imputacionPadronIdColaterales ?? null;
          estado = (upd.estado as any) ?? 'baja';
        } else {
          // Creamos el registro de coseguro si no existe, SIN activar nada
          // (no cambiamos estado acá; la activación de J22 es otro flujo)
          const created = await tx.coseguroAfiliado.create({
            data: {
              afiliadoId: afId,
              organizacionId,
              estado: 'baja', // mantenemos política conservadora
              fechaAlta: ahora, // requerido por el esquema
              imputacionPadronIdColaterales: pId,
            },
            select: { imputacionPadronIdColaterales: true, estado: true },
          });

          prevPadron = null;
          nuevoPadron = created.imputacionPadronIdColaterales ?? null;
          estado = (created.estado as any) ?? 'baja';
        }

        return { previoPadronId: prevPadron, nuevoPadronId: nuevoPadron, estadoFinal: estado };
      },
    );

    // Las novedades de cambio de imputación J38 se detectan como delta vs el
    // último envío al generar el lote (módulo nuevo TODO).
    void previoPadronId;
    void nuevoPadronId;
    void estadoFinal;
    void totalJ38;
    void ahora;

    return { ok: true, padronColatId: pId.toString() };
  }
}
