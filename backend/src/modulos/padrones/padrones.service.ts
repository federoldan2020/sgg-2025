import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { toJSONSafe } from '../../common/bigint.util';
import { PageQuery, parsePage } from '../../common/pagination.util';

import { CreatePadronDto } from './dto/create-padron.dto';
import { UpdatePadronDto } from './dto/update-padron.dto';
import { PadronesQueryDto } from './dto/padrones-query.dto';
import { NovedadesPendientesService } from '../novedades/novedades-pendientes.service';

/** % de cuota societaria UDAP (2.00%). TODO: leer de OrganizacionConfig. */
const J17_PORCENTAJE_DEFAULT = 2.0;

const MOTIVOS_BAJA_PERMITIDOS = new Set<string>([
  'renuncia',
  'jubilación',
  'fallecimiento',
  'cambio de padrón',
  'suspensión administrativa',
  'error de carga / Corrección',
  'baja lógica', // fallback técnico
]);

function assertMotivoValido(motivo?: string) {
  if (!motivo) return;
  if (!MOTIVOS_BAJA_PERMITIDOS.has(motivo)) {
    throw new BadRequestException('Motivo de baja no permitido');
  }
}

function assertFechaNoFutura(fecha?: Date | string) {
  if (!fecha) return;
  const d = new Date(String(fecha));
  const now = new Date();
  if (d.getTime() > now.getTime()) {
    throw new BadRequestException('La fecha de baja no puede ser futura');
  }
}

@Injectable()
export class PadronesService {
  private readonly logger = new Logger(PadronesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly novedadesPendientes: NovedadesPendientesService,
  ) {}

  // =============================================================
  // CREATE
  // =============================================================
  async create(organizacionId: string, dto: CreatePadronDto) {
    // Validaciones de negocio
    assertMotivoValido(dto.motivoBaja);
    assertFechaNoFutura(dto.fechaBaja);

    return this.prisma.$transaction(async (tx) => {
      // 1) Afiliado: usar el existente o crear uno nuevo
      let afiliadoId: bigint;

      if (dto.afiliadoId) {
        const a = await tx.afiliado.findFirst({
          where: { id: BigInt(dto.afiliadoId), organizacionId },
          select: { id: true },
        });
        if (!a) throw new NotFoundException('Afiliado no encontrado en la organización');
        afiliadoId = a.id;
      } else if (dto.afiliadoNuevo) {
        const nuevo = await tx.afiliado.create({
          data: {
            organizacion: { connect: { id: organizacionId } },
            dni: BigInt(dto.afiliadoNuevo.dni),
            apellido: dto.afiliadoNuevo.apellido.trim(),
            nombre: dto.afiliadoNuevo.nombre.trim(),
            estado: 'activo',
            cuit: dto.afiliadoNuevo.cuit ?? undefined,
            sexo: dto.afiliadoNuevo.sexo ?? undefined,
            tipo: dto.afiliadoNuevo.tipo ?? undefined,
            telefono: dto.afiliadoNuevo.telefono ?? undefined,
            celular: dto.afiliadoNuevo.celular ?? undefined,
            calle: dto.afiliadoNuevo.calle ?? undefined,
            numero: dto.afiliadoNuevo.numero ?? undefined,
            orientacion: dto.afiliadoNuevo.orientacion ?? undefined,
            barrio: dto.afiliadoNuevo.barrio ?? undefined,
            piso: dto.afiliadoNuevo.piso ?? undefined,
            depto: dto.afiliadoNuevo.depto ?? undefined,
            monoblock: dto.afiliadoNuevo.monoblock ?? undefined,
            casa: dto.afiliadoNuevo.casa ?? undefined,
            manzana: dto.afiliadoNuevo.manzana ?? undefined,
            localidad: dto.afiliadoNuevo.localidad ?? undefined,
            fechaNacimiento: dto.afiliadoNuevo.fechaNacimiento
              ? new Date(dto.afiliadoNuevo.fechaNacimiento)
              : undefined,
            numeroSocio: dto.afiliadoNuevo.numeroSocio ?? undefined,
            cupo: dto.afiliadoNuevo.cupo ?? undefined,
            saldo: dto.afiliadoNuevo.saldo ?? undefined,
            observaciones: dto.afiliadoNuevo.observaciones ?? undefined,
          },
          select: { id: true },
        });
        afiliadoId = nuevo.id;
      } else {
        throw new BadRequestException('Debe indicar afiliadoId o afiliadoNuevo');
      }

      // 2) Crear padrón
      const pad = await tx.padron.create({
        data: {
          organizacion: { connect: { id: organizacionId } },
          afiliado: { connect: { id: afiliadoId } },
          padron: dto.padron.trim(),
          centro: dto.centro ?? undefined,
          sector: dto.sector ?? undefined,
          clase: dto.clase ?? undefined,
          situacion: dto.situacion ?? undefined,
          fechaAlta: dto.fechaAlta ? new Date(dto.fechaAlta) : undefined,
          fechaBaja: dto.fechaBaja ? new Date(dto.fechaBaja) : undefined,
          activo: typeof dto.activo === 'boolean' ? dto.activo : true,
          j17: dto.j17 ?? undefined,
          j22: dto.j22 ?? undefined,
          j38: dto.j38 ?? undefined,
          k16: dto.k16 ?? undefined,
          motivoBaja: dto.motivoBaja ?? undefined,
          cajaAhorro: dto.cajaAhorro ?? undefined,
          beneficiarioJubilado: dto.beneficiarioJubilado ?? undefined,
          sistema: dto.sistema ?? undefined,
          sueldoBasico: dto.sueldoBasico ?? undefined,
          cupo: dto.cupo ?? undefined,
          saldo: dto.saldo ?? undefined,
        },
      });

      // 2b) Derivar estado del afiliado (≥1 padrón activo ⇒ 'activo')
      await this.recomputeAfiliadoEstadoTx(tx, organizacionId, afiliadoId);

      // 3) (opcional) crear coseguro conectado a este padrón
      let creoCoseguro = false;
      let coseguroId: bigint | undefined;

      if (dto.crearCoseguro) {
        const ya = await tx.coseguroAfiliado.findUnique({
          where: { afiliadoId },
          select: { id: true },
        });

        if (!ya) {
          const nuevoC = await tx.coseguroAfiliado.create({
            data: {
              organizacion: { connect: { id: organizacionId } },
              afiliado: { connect: { id: afiliadoId } },
              fechaAlta: new Date(),
              estado: 'activo',
              padronCoseguro: { connect: { id: pad.id } },
              padronColat: { connect: { id: pad.id } },
            },
            select: { id: true },
          });
          coseguroId = nuevoC.id;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          creoCoseguro = true;
        } else {
          coseguroId = ya.id;
        }

        // Si se pasaron colaterales iniciales, crearlos vinculados
        if (dto.colaterales?.length) {
          for (const c of dto.colaterales) {
            await tx.colateral.create({
              // Usamos UncheckedCreate con IDs escalares para evitar problemas de tipos
              data: {
                afiliadoId, // SIEMPRE pertenece al afiliado
                parentescoId: BigInt(c.parentescoId),
                nombre: (c.nombre || '').trim(),
                dni: c.dni ? String(c.dni).trim() : null,
                fechaNacimiento: c.fechaNacimiento ? new Date(c.fechaNacimiento) : null, // nunca undefined
                activo: typeof c.activo === 'boolean' ? c.activo : true,
                esColateral: true, // participa de J38
                ...(coseguroId ? { coseguroId } : {}), // si hay coseguro, lo imputamos
              } satisfies Prisma.ColateralUncheckedCreateInput,
              include: { parentesco: true, coseguro: true },
            });
          }
        }
      }

      return pad;
    }).then(async (pad) => {
      // Emitir ALTA J17 en la cola de novedades pendientes.
      // Destino: ANSES si el padrón trae numeroBeneficio, COMPUTOS en otro caso.
      await this.emitirJ17(pad as any, 'alta', 'hook_afiliado_alta');
      return toJSONSafe(pad);
    });
  }

  /**
   * Emite una NovedadPendiente J17 alta/baja para el padrón. Manejo de errores:
   * si la emisión falla loggeamos pero NO rompemos la operación principal
   * (el padrón ya quedó creado/dado de baja en BD).
   */
  private async emitirJ17(
    padron: { id: bigint; organizacionId: string; afiliadoId: bigint; numeroBeneficio?: string | null },
    tipo: 'alta' | 'baja',
    origen: 'hook_afiliado_alta' | 'hook_afiliado_baja',
  ): Promise<void> {
    try {
      const destino: 'COMPUTOS' | 'ANSES' = padron.numeroBeneficio ? 'ANSES' : 'COMPUTOS';
      await this.novedadesPendientes.crear({
        organizacionId: padron.organizacionId,
        padronId: padron.id,
        afiliadoId: padron.afiliadoId,
        concepto: 'J17',
        tipoMovimiento: tipo,
        destino,
        valor: tipo === 'baja' ? null : J17_PORCENTAJE_DEFAULT,
        origenEvento: origen,
      });
    } catch (err) {
      this.logger.error(
        `Fallo emitiendo NovedadPendiente J17 ${tipo} padrón ${padron.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // =============================================================
  // LIST / GET
  // =============================================================
  async findAll(organizacionId: string, afiliadoId?: number) {
    const where: any = { organizacionId };
    if (afiliadoId) where.afiliadoId = BigInt(afiliadoId);

    const list = await this.prisma.padron.findMany({
      where,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        padron: true,
        afiliadoId: true,
        activo: true,
        sistema: true,
        centro: true,
        sector: true,
        clase: true,
        saldo: true,
        cupo: true,
      },
    });
    return toJSONSafe(list);
  }

  async findPaged(organizacionId: string, params: PadronesQueryDto & PageQuery) {
    const { skip, take } = parsePage(params);
    const q = params.q?.trim();
    const afiliadoId =
      params.afiliadoId && /^\d+$/.test(params.afiliadoId) ? BigInt(params.afiliadoId) : undefined;
    const sistema = params.sistema;
    const activo = typeof params.activo !== 'undefined' ? params.activo === 'true' : undefined;

    const where: Prisma.PadronWhereInput = {
      organizacionId,
      ...(afiliadoId ? { afiliadoId } : {}),
      ...(sistema ? { sistema } : {}),
      ...(typeof activo === 'boolean' ? { activo } : {}),
      ...(q
        ? {
            OR: [
              { padron: { contains: q, mode: 'insensitive' } },
              { situacion: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.padron.findMany({ where, skip, take, orderBy: { id: 'asc' } }),
      this.prisma.padron.count({ where }),
    ]);

    return toJSONSafe({ items, total, page: Math.floor(skip / take) + 1, limit: take });
  }

  async findOne(organizacionId: string, id: bigint) {
    const found = await this.prisma.padron.findFirst({ where: { organizacionId, id } });
    if (!found) throw new Error('Padrón no encontrado');
    return toJSONSafe(found);
  }

  // =============================================================
  // UPDATE
  // =============================================================
  async update(organizacionId: string, id: bigint, dto: UpdatePadronDto) {
    await this.ensureOrg(organizacionId, id);

    // Validaciones de negocio
    assertMotivoValido(dto.motivoBaja);
    assertFechaNoFutura(dto.fechaBaja);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const upd = await tx.padron.update({
          where: { id },
          data: {
            padron: dto.padron ?? undefined,
            centro: dto.centro ?? undefined,
            sector: dto.sector ?? undefined,
            clase: dto.clase ?? undefined,
            situacion: dto.situacion ?? undefined,

            fechaAlta: dto.fechaAlta ? new Date(String(dto.fechaAlta)) : undefined,
            fechaBaja: dto.fechaBaja ? new Date(String(dto.fechaBaja)) : undefined,
            activo: typeof dto.activo === 'boolean' ? dto.activo : undefined,

            j17: dto.j17 ?? undefined,
            j22: dto.j22 ?? undefined,
            j38: dto.j38 ?? undefined,
            k16: dto.k16 ?? undefined,

            motivoBaja: dto.motivoBaja ?? undefined,
            cajaAhorro: dto.cajaAhorro ?? undefined,
            beneficiarioJubilado: dto.beneficiarioJubilado ?? undefined,

            sistema: dto.sistema ?? undefined,
            sueldoBasico: dto.sueldoBasico ?? undefined,
            cupo: dto.cupo ?? undefined,
            saldo: dto.saldo ?? undefined,
          },
          select: { id: true, afiliadoId: true, activo: true },
        });

        // Si el payload traía 'activo', recalcular estado del afiliado derivado
        if (typeof dto.activo === 'boolean') {
          await this.recomputeAfiliadoEstadoTx(tx, organizacionId, upd.afiliadoId);
        }

        return upd;
      });

      return toJSONSafe(updated);
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') {
          throw new ConflictException('Ya existe un padrón con ese código en la organización');
        }
        if (e.code === 'P2025') {
          throw new NotFoundException('Padrón no encontrado');
        }
      }
      throw e;
    }
  }

  // =============================================================
  // REMOVE (Siempre Soft con Cascada Opción B)
  // =============================================================
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async remove(organizacionId: string, id: bigint, _hard = false) {
    // Traer datos clave (afiliadoId) antes de tocarlo
    const padron = await this.prisma.padron.findFirst({
      where: { id, organizacionId },
      select: { id: true, afiliadoId: true },
    });
    if (!padron) throw new NotFoundException('Padrón no encontrado');

    const afiliadoId = padron.afiliadoId;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // 1) Soft delete del padrón (fecha y motivo)
        const ahora = new Date();
        const padronSoft = await tx.padron.update({
          where: { id },
          data: {
            activo: false,
            fechaBaja: ahora,
            // Si luego querés pasar el motivo desde el controller, usalo aquí; por ahora, default técnico:
            motivoBaja: 'baja lógica',
          },
          select: { id: true, afiliadoId: true },
        });

        // 2) ¿Está imputado en algún Coseguro? (padronCoseguro o padronColat)
        const coseguro = await tx.coseguroAfiliado.findFirst({
          where: {
            afiliadoId,
            organizacionId,
            OR: [{ padronCoseguro: { id } }, { padronColat: { id } }],
          },
          select: { afiliadoId: true },
        });

        // 3) Si está imputado ⇒ Opción B: bajar Coseguro y todos los Colaterales
        if (coseguro) {
          await tx.coseguroAfiliado.update({
            where: { afiliadoId }, // unique
            data: {
              estado: 'baja',
              fechaBaja: ahora,
            },
          });

          // Baja masiva de colaterales (no deben quedar activos)
          await tx.colateral.updateMany({
            where: {
              afiliadoId,
              coseguroId: { not: null }, // más robusto que filtrar por relación
            },
            data: { activo: false },
          });
        }

        // 4) Recalcular estado del afiliado (por padrones activos)
        await this.recomputeAfiliadoEstadoTx(tx, organizacionId, afiliadoId);

        return padronSoft;
      });

      // Emitir BAJA J17 en la cola de novedades pendientes.
      const padFull = await this.prisma.padron.findUnique({
        where: { id: result.id },
        select: { id: true, organizacionId: true, afiliadoId: true, numeroBeneficio: true },
      });
      if (padFull) {
        await this.emitirJ17(padFull, 'baja', 'hook_afiliado_baja');
      }

      return toJSONSafe(result);
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Padrón no encontrado');
      }
      throw e;
    }
  }

  // =============================================================
  // Helpers
  // =============================================================
  private async ensureOrg(organizacionId: string, id: bigint) {
    const exists = await this.prisma.padron.findFirst({
      where: { id, organizacionId },
      select: { id: true },
    });
    if (!exists) throw new Error('Padrón no pertenece a la organización');
  }

  /** Recalcula `afiliado.estado` en base a si tiene ≥1 padrón activo */
  private async recomputeAfiliadoEstadoTx(
    tx: Prisma.TransactionClient,
    organizacionId: string,
    afiliadoId: bigint,
  ) {
    const activos = await tx.padron.count({
      where: { organizacionId, afiliadoId, activo: true },
    });
    await tx.afiliado.update({
      where: { id: afiliadoId },
      data: { estado: activos > 0 ? 'activo' : 'baja' },
    });
  }
}
