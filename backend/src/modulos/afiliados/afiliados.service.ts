import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateAfiliadoDto } from './dto/create-afiliado.dto';
import { UpdateAfiliadoDto } from './dto/update-afiliado.dto';
import { Prisma } from '@prisma/client';
import { toJSONSafe } from '../../common/bigint.util';
import { PageQuery, parsePage } from '../../common/pagination.util';
import { AfiliadosQueryDto } from './dto/afiliados-query.dto';
import { AfiliadosSuggestQueryDto } from './dto/afiliados-suggest.dto';

@Injectable()
export class AfiliadosService {
  constructor(private prisma: PrismaService) {}

  async create(organizacionId: string, dto: CreateAfiliadoDto) {
    try {
      const data: Prisma.AfiliadoCreateInput = {
        organizacion: { connect: { id: organizacionId } },
        dni: BigInt(dto.dni),
        apellido: dto.apellido,
        nombre: dto.nombre,
        cuit: dto.cuit ?? null,
        sexo: (dto as any).sexo ?? null,
        tipo: (dto as any).tipo ?? null,

        // Contacto
        telefono: dto.telefono ?? null,
        celular: dto.celular ?? null,

        // Domicilio
        calle: dto.calle ?? null,
        numero: dto.numero ?? null,
        orientacion: dto.orientacion ?? null,
        barrio: dto.barrio ?? null,
        piso: dto.piso ?? null,
        depto: dto.depto ?? null,
        monoblock: dto.monoblock ?? null,
        casa: dto.casa ?? null,
        manzana: dto.manzana ?? null,
        localidad: dto.localidad ?? null,

        // Otros
        fechaNacimiento: dto.fechaNacimiento ? new Date(dto.fechaNacimiento) : null,
        numeroSocio: dto.numeroSocio ?? null,
        cupo: dto.cupo ?? undefined, // Decimal (string)
        saldo: dto.saldo ?? undefined, // Decimal (string)
        observaciones: dto.observaciones ?? null,
      };

      const created = await this.prisma.afiliado.create({ data });
      return toJSONSafe(created);
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new Error('Ya existe un afiliado con ese DNI o CUIT en la organización.');
      }
      throw e;
    }
  }

  async suggest(organizacionId: string, qdto: AfiliadosSuggestQueryDto) {
    const q = qdto.q.trim();
    const isNumeric = /^\d+$/.test(q);

    // Armamos un OR que cubra:
    // - DNI numérico (match exacto o contains por si falta dígito)
    // - Apellido contains (caso migrado ape_nom en 'apellido')
    // - Nombre contains (si está bien normalizado)
    const where: any = { organizacionId };
    const OR: any[] = [];

    if (isNumeric) {
      OR.push({ dni: BigInt(q) }); // match exacto
    }
    OR.push({ apellido: { contains: q, mode: 'insensitive' } });
    OR.push({ nombre: { contains: q, mode: 'insensitive' } });

    const items = await this.prisma.afiliado.findMany({
      where: { ...where, OR },
      select: { id: true, dni: true, apellido: true, nombre: true },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      take: 10,
    });

    // Devolvemos lightweight + display listo para frontend
    const map = items.map((a) => ({
      id: a.id,
      dni: a.dni,
      display:
        a.apellido && a.nombre
          ? `${a.apellido}, ${a.nombre}`
          : a.apellido || a.nombre || '(sin nombre)',
    }));

    return map;
  }
  async findPaged(organizacionId: string, params: AfiliadosQueryDto & PageQuery) {
    const { skip, take } = parsePage(params);
    const q = params.q?.trim();
    const estado = params.estado;
    const tipo = params.tipo;

    const conCoseguro = params.conCoseguro === 'true';
    const conColaterales = params.conColaterales === 'true';
    /*
    console.log('🔍 Parámetros recibidos:', {
      organizacionId,
      q,
      estado,
      tipo,
      conCoseguro,
      conColaterales,
      page: Math.floor(skip / take) + 1,
      limit: take,
    });
    */

    const where: Prisma.AfiliadoWhereInput = {
      organizacionId,
      ...(estado ? { estado } : {}),
      ...(tipo ? { tipo } : {}),
      ...(conCoseguro || conColaterales
        ? {
            coseguro: { isNot: null },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { apellido: { contains: q, mode: 'insensitive' } },
              { nombre: { contains: q, mode: 'insensitive' } },
              { cuit: { contains: q, mode: 'insensitive' } },
              ...(Number.isFinite(Number(q)) ? [{ dni: BigInt(q) }] : []),
            ],
          }
        : {}),
    };

    // console.log('📋 Query WHERE construido:', JSON.stringify(where, null, 2));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.afiliado.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'desc' },
        include: {
          padrones: {
            where: { activo: true },
            select: {
              id: true,
              padron: true,
            },
          },
          coseguro: {
            select: {
              id: true,
              estado: true,
              colaterales: {
                where: { activo: true },
                select: { id: true },
              },
            },
          },
        },
      }),
      this.prisma.afiliado.count({ where }),
    ]);

    //  console.log(`📊 Resultados de BD: ${items.length} items de ${total} total`);

    // Log de un item de ejemplo para ver la estructura
    if (items.length > 0) {
      /*
      console.log('🔍 Estructura del primer item de BD:', {
        id: items[0].id,
        apellido: items[0].apellido,
        nombre: items[0].nombre,
        padrones: items[0].padrones,
        coseguro: items[0].coseguro,
      });
      */
    }

    // Filtrar en memoria según los criterios específicos
    let filteredItems = items;

    if (conCoseguro && !conColaterales) {
      filteredItems = items.filter((item) => item.coseguro && item.coseguro.estado === 'activo');
      //console.log(`🔎 Filtro coseguro: ${filteredItems.length} items después del filtro`);
    } else if (conColaterales) {
      filteredItems = items.filter(
        (item) =>
          item.coseguro &&
          item.coseguro.estado === 'activo' &&
          item.coseguro.colaterales &&
          item.coseguro.colaterales.length > 0,
      );
      //console.log(`🔎 Filtro colaterales: ${filteredItems.length} items después del filtro`);
    }

    const mappedItems = filteredItems.map((item) => ({
      ...item,
      padronesActivos: item.padrones.map((p) => ({
        id: p.id,
        padron: p.padron,
      })),
      coseguro: !!(item.coseguro && item.coseguro.estado === 'activo'),
      colaterales: !!(
        item.coseguro?.estado === 'activo' &&
        item.coseguro?.colaterales &&
        item.coseguro.colaterales.length > 0
      ),
      //padrones: undefined, // <- Quita esta línea también
    }));

    // Log del resultado final
    /*
    if (mappedItems.length > 0) {
      console.log('📤 Estructura del primer item mapeado que se envía al frontend:', {
        id: mappedItems[0].id,
        apellido: mappedItems[0].apellido,
        nombre: mappedItems[0].nombre,
        padronesActivos: mappedItems[0].padronesActivos,
        coseguro: mappedItems[0].coseguro,
        colaterales: mappedItems[0].colaterales,
      });
    }
      */

    const adjustedTotal = conCoseguro || conColaterales ? filteredItems.length : total;

    const result = {
      items: mappedItems,
      total: adjustedTotal,
      page: Math.floor(skip / take) + 1,
      limit: take,
    };
    /*
    console.log('🚀 Respuesta final enviada al frontend:', {
      totalItems: result.items.length,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
    */

    return toJSONSafe(result);
  }

  // En afiliados.service.ts
  async findAll(organizacionId: string) {
    const list = await this.prisma.afiliado.findMany({
      where: { organizacionId },
      orderBy: { id: 'desc' },
      include: {
        padrones: {
          where: { activo: true },
          select: {
            id: true,
            padron: true,
          },
        },
        coseguro: {
          select: {
            id: true,
            estado: true,
            colaterales: {
              where: { activo: true },
              select: { id: true },
            },
          },
        },
      },
    });

    const mappedItems = list.map((item) => ({
      ...item,
      padronesActivos: item.padrones.map((p) => ({
        id: p.id,
        padron: p.padron,
      })),
      coseguro: !!(item.coseguro && item.coseguro.estado === 'activo'),
      colaterales: !!(
        item.coseguro?.estado === 'activo' &&
        item.coseguro?.colaterales &&
        item.coseguro.colaterales.length > 0
      ),
    }));

    return toJSONSafe(mappedItems);
  }

  async findOne(organizacionId: string, id: bigint) {
    const found = await this.prisma.afiliado.findFirst({ where: { organizacionId, id } });
    if (!found) throw new Error('Afiliado no encontrado');
    return toJSONSafe(found);
  }

  async update(organizacionId: string, id: bigint, dto: UpdateAfiliadoDto) {
    try {
      await this.ensureOrg(organizacionId, id);
      const updated = await this.prisma.afiliado.update({
        where: { id },
        data: this.mapUpdate(dto),
      });
      return toJSONSafe(updated);
    } catch (e: any) {
      if (e?.code === 'P2025') throw new Error('Afiliado no encontrado');
      if (e?.code === 'P2002') throw new Error('DNI/CUIT duplicado en la organización');
      throw e;
    }
  }

  async remove(organizacionId: string, id: bigint, hard = false) {
    if (!hard) {
      // Soft delete → estado = 'baja'
      return this.update(organizacionId, id, { estado: 'baja' });
    }
    try {
      await this.ensureOrg(organizacionId, id);
      const deleted = await this.prisma.afiliado.delete({ where: { id } });
      return toJSONSafe(deleted);
    } catch (e: any) {
      if (e?.code === 'P2025') throw new Error('Afiliado no encontrado');
      throw e;
    }
  }

  // -------- helpers privados
  private async ensureOrg(organizacionId: string, id: bigint) {
    const exists = await this.prisma.afiliado.findFirst({
      where: { id, organizacionId },
      select: { id: true },
    });
    if (!exists) throw new Error('Afiliado no pertenece a la organización');
  }

  private mapUpdate(dto: UpdateAfiliadoDto): Prisma.AfiliadoUpdateInput {
    return {
      apellido: dto.apellido ?? undefined,
      nombre: dto.nombre ?? undefined,
      estado: dto.estado ?? undefined,
      cuit: dto.cuit ?? undefined,
      sexo: dto.sexo ?? undefined,
      tipo: dto.tipo ?? undefined,
      telefono: dto.telefono ?? undefined,
      celular: dto.celular ?? undefined,
      calle: dto.calle ?? undefined,
      numero: dto.numero ?? undefined,
      orientacion: dto.orientacion ?? undefined,
      barrio: dto.barrio ?? undefined,
      piso: dto.piso ?? undefined,
      depto: dto.depto ?? undefined,
      monoblock: dto.monoblock ?? undefined,
      casa: dto.casa ?? undefined,
      manzana: dto.manzana ?? undefined,
      localidad: dto.localidad ?? undefined,
      fechaNacimiento: dto.fechaNacimiento ? new Date(String(dto.fechaNacimiento)) : undefined,
      numeroSocio: dto.numeroSocio ?? undefined,
      cupo: dto.cupo ?? undefined,
      saldo: dto.saldo ?? undefined,
      observaciones: dto.observaciones ?? undefined,
    };
  }
}
