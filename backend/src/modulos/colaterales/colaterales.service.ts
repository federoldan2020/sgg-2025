import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NovedadesService } from '../novedades/novedades.service';
import { ColateralesCalculoService } from './colaterales-calculo.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly novedades: NovedadesService,
    private readonly calc: ColateralesCalculoService,
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

  // ----------------- util novedades post-mutate -----------------
  private async afterChangeRecalcularYNotificar(
    organizacionId: string,
    afiliadoId: bigint,
    fecha: Date,
    totalAntes: any, // Decimal-like (de Prisma)
    observacionAlta: string,
    observacionBaja: string,
    observacionModif: string,
  ) {
    const totalDespues = await this.calc.calcularTotalJ38(organizacionId, afiliadoId, fecha);
    if (!totalAntes.equals(totalDespues)) {
      const padronId = await this.calc.getPadronDestino(organizacionId, afiliadoId);
      if (totalAntes.isZero() && !totalDespues.isZero()) {
        await this.novedades.registrarAltaColaterales({
          organizacionId,
          afiliadoId,
          padronId: padronId ?? 0n,
          ocurridoEn: fecha,
          observacion: observacionAlta,
          total: totalDespues,
        });
      } else if (!totalAntes.isZero() && totalDespues.isZero()) {
        await this.novedades.registrarBajaColaterales({
          organizacionId,
          afiliadoId,
          padronId: padronId ?? 0n,
          ocurridoEn: fecha,
          observacion: observacionBaja,
        });
      } else {
        await this.novedades.registrarModifColaterales({
          organizacionId,
          afiliadoId,
          padronId: padronId ?? 0n,
          ocurridoEn: fecha,
          observacion: observacionModif,
          nuevoTotal: totalDespues,
        });
      }
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
      select: { id: true, dni: true },
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

    // 4) Novedades por CAMBIO de imputación J38
    // Regla pedida:
    // - Si cambió el padrón y hay J38 (>0) y el coseguro está ACTIVO:
    //     * Baja en padrón anterior (si existía)
    //     * Alta en padrón nuevo con el total vigente
    // - Si cambió el padrón pero total J38 == 0 o coseguro en baja:
    //     * Registramos una modificación "informativa" (sin cargo) sobre el nuevo padrón
    const cambioPadron =
      (previoPadronId ?? null) !== (nuevoPadronId ?? null) &&
      (previoPadronId != null || nuevoPadronId != null);

    if (cambioPadron) {
      const hayCargo = !totalJ38.isZero();
      const coseguroActivo = estadoFinal === 'activo';

      if (hayCargo && coseguroActivo) {
        // Baja en el padrón anterior (si existía)
        if (previoPadronId != null) {
          await this.novedades.registrarBajaColaterales({
            organizacionId,
            afiliadoId: afId,
            padronId: previoPadronId,
            ocurridoEn: ahora,
            observacion: 'Cambio imputación J38: baja en padrón anterior',
          });
        }
        // Alta en el padrón nuevo con el total vigente
        if (nuevoPadronId != null) {
          await this.novedades.registrarAltaColaterales({
            organizacionId,
            afiliadoId: afId,
            padronId: nuevoPadronId,
            ocurridoEn: ahora,
            observacion: 'Cambio imputación J38: alta en padrón nuevo',
            total: totalJ38,
          });
        }
      } else {
        // Sin cargo (total 0) o coseguro inactivo: dejamos traza de modificación
        await this.novedades.registrarModifColaterales({
          organizacionId,
          afiliadoId: afId,
          padronId: nuevoPadronId ?? (await this.calc.getPadronDestino(organizacionId, afId)) ?? 0n,
          ocurridoEn: ahora,
          observacion: 'Cambio imputación J38 sin cargo (total=0 o coseguro inactivo)',
          nuevoTotal: totalJ38, // probablemente 0
        });
      }
    }

    return { ok: true, padronColatId: pId.toString() };
  }
}
