import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import * as bcrypt from 'bcryptjs';
import type {
  CrearFarmaciaDto,
  EditarFarmaciaDto,
  CambiarPasswordFarmaciaDto,
} from './dtos';

/**
 * CRUD interno (admin) de farmacias.
 *
 * Las farmacias internas (esInterna=true) NO necesitan credenciales — sus
 * consumos los registra el personal del gremio desde el admin.
 *
 * Las farmacias externas tienen `usuario` + `passwordHash` para loguearse
 * en /farmacia-externa. La password se hashea con bcrypt.
 */
@Injectable()
export class FarmaciasService {
  constructor(private readonly prisma: PrismaService) {}

  list(orgId: string) {
    return this.prisma.farmacia.findMany({
      where: { organizacionId: orgId },
      orderBy: [{ activo: 'desc' }, { esInterna: 'desc' }, { nombre: 'asc' }],
      select: {
        id: true,
        codigo: true,
        nombre: true,
        cuit: true,
        direccion: true,
        localidad: true,
        telefono: true,
        email: true,
        esInterna: true,
        usuario: true,
        activo: true,
        creadoEn: true,
      },
    });
  }

  async get(orgId: string, id: string) {
    const row = await this.prisma.farmacia.findFirst({
      where: { id: BigInt(id), organizacionId: orgId },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        cuit: true,
        direccion: true,
        localidad: true,
        telefono: true,
        email: true,
        esInterna: true,
        usuario: true,
        activo: true,
        creadoEn: true,
      },
    });
    if (!row) throw new NotFoundException('Farmacia no encontrada');
    return row;
  }

  async create(orgId: string, dto: CrearFarmaciaDto) {
    const esInterna = dto.esInterna ?? false;
    if (!esInterna) {
      if (!dto.usuario) {
        throw new BadRequestException('Farmacia externa requiere `usuario`');
      }
    }

    // Validar unicidad de código por org
    const dupCod = await this.prisma.farmacia.findFirst({
      where: { organizacionId: orgId, codigo: dto.codigo.trim() },
      select: { id: true },
    });
    if (dupCod) throw new ConflictException('Ya existe una farmacia con ese código');

    // Validar unicidad de usuario global (si viene)
    if (dto.usuario) {
      const dupUsr = await this.prisma.farmacia.findFirst({
        where: { usuario: dto.usuario.trim() },
        select: { id: true },
      });
      if (dupUsr) throw new ConflictException('Ya existe una farmacia con ese usuario');
    }

    const passwordPlano = !esInterna ? (dto.password ?? generarPasswordTemporal()) : null;
    const passwordHash = passwordPlano ? await bcrypt.hash(passwordPlano, 10) : null;

    const creada = await this.prisma.farmacia.create({
      data: {
        organizacionId: orgId,
        codigo: dto.codigo.trim(),
        nombre: dto.nombre.trim(),
        cuit: dto.cuit?.trim() || null,
        direccion: dto.direccion?.trim() || null,
        localidad: dto.localidad?.trim() || null,
        telefono: dto.telefono?.trim() || null,
        email: dto.email?.trim() || null,
        esInterna,
        usuario: !esInterna ? dto.usuario!.trim() : null,
        passwordHash,
        activo: dto.activo ?? true,
      },
      select: { id: true, codigo: true, usuario: true, esInterna: true },
    });

    return {
      ...creada,
      id: creada.id.toString(),
      // ⚠ Devolvemos el password EN PLANO solo en el alta — se le muestra al
      // operario para que se lo entregue a la farmacia, no se guarda en
      // ninguna parte. Una vez cerrada la pantalla no se puede recuperar.
      passwordTemporal: passwordPlano,
    };
  }

  async update(orgId: string, id: string, dto: EditarFarmaciaDto) {
    const rid = BigInt(id);
    const existe = await this.prisma.farmacia.findFirst({
      where: { id: rid, organizacionId: orgId },
      select: { id: true, esInterna: true },
    });
    if (!existe) throw new NotFoundException('Farmacia no encontrada');

    if (dto.usuario) {
      const dup = await this.prisma.farmacia.findFirst({
        where: { usuario: dto.usuario.trim(), NOT: { id: rid } },
        select: { id: true },
      });
      if (dup) throw new ConflictException('Ese usuario ya está tomado');
    }

    const updated = await this.prisma.farmacia.update({
      where: { id: rid },
      data: {
        ...(dto.nombre != null ? { nombre: dto.nombre.trim() } : {}),
        ...(dto.cuit !== undefined ? { cuit: dto.cuit?.trim() || null } : {}),
        ...(dto.direccion !== undefined ? { direccion: dto.direccion?.trim() || null } : {}),
        ...(dto.localidad !== undefined ? { localidad: dto.localidad?.trim() || null } : {}),
        ...(dto.telefono !== undefined ? { telefono: dto.telefono?.trim() || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
        ...(dto.usuario !== undefined ? { usuario: dto.usuario?.trim() || null } : {}),
        ...(dto.activo != null ? { activo: dto.activo } : {}),
      },
    });
    return { id: updated.id.toString(), ok: true as const };
  }

  async cambiarPassword(orgId: string, id: string, dto: CambiarPasswordFarmaciaDto) {
    const rid = BigInt(id);
    const existe = await this.prisma.farmacia.findFirst({
      where: { id: rid, organizacionId: orgId },
      select: { esInterna: true },
    });
    if (!existe) throw new NotFoundException('Farmacia no encontrada');
    if (existe.esInterna) {
      throw new BadRequestException('Las farmacias internas no usan password');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.farmacia.update({ where: { id: rid }, data: { passwordHash } });
    return { ok: true as const };
  }

  /** Reset del password — devuelve uno temporal. */
  async resetPassword(orgId: string, id: string) {
    const rid = BigInt(id);
    const existe = await this.prisma.farmacia.findFirst({
      where: { id: rid, organizacionId: orgId },
      select: { esInterna: true },
    });
    if (!existe) throw new NotFoundException('Farmacia no encontrada');
    if (existe.esInterna) {
      throw new BadRequestException('Las farmacias internas no usan password');
    }
    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordTemporal, 10);
    await this.prisma.farmacia.update({ where: { id: rid }, data: { passwordHash } });
    return { ok: true as const, passwordTemporal };
  }

  async remove(orgId: string, id: string) {
    const rid = BigInt(id);
    const existe = await this.prisma.farmacia.findFirst({
      where: { id: rid, organizacionId: orgId },
      select: { id: true },
    });
    if (!existe) throw new NotFoundException('Farmacia no encontrada');
    // Soft-delete via flag para preservar la trazabilidad de consumos históricos.
    await this.prisma.farmacia.update({ where: { id: rid }, data: { activo: false } });
    return { ok: true as const };
  }
}

function generarPasswordTemporal(): string {
  // 12 chars alfanum (sin caracteres ambiguos l/I/0/O)
  const alphabet = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
