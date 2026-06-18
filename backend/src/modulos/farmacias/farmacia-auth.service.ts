import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import type { LoginFarmaciaDto } from './dtos';

export interface FarmaciaJwtPayload {
  sub: string; // farmacia id (BigInt como string)
  organizacionId: string;
  type: 'farmacia';
  codigo: string;
  nombre: string;
}

export interface LoginFarmaciaResponse {
  accessToken: string;
  expiresIn: number;
  farmacia: {
    id: string;
    codigo: string;
    nombre: string;
    organizacionId: string;
  };
}

@Injectable()
export class FarmaciaAuthService {
  private readonly logger = new Logger(FarmaciaAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginFarmaciaDto): Promise<LoginFarmaciaResponse> {
    const usuario = dto.usuario.trim();
    const farmacia = await this.prisma.farmacia.findFirst({
      where: { usuario },
      select: {
        id: true,
        codigo: true,
        nombre: true,
        organizacionId: true,
        passwordHash: true,
        esInterna: true,
        activo: true,
      },
    });

    if (!farmacia || !farmacia.activo || farmacia.esInterna || !farmacia.passwordHash) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    const ok = await bcrypt.compare(dto.password, farmacia.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    const payload: FarmaciaJwtPayload = {
      sub: farmacia.id.toString(),
      organizacionId: farmacia.organizacionId,
      type: 'farmacia',
      codigo: farmacia.codigo,
      nombre: farmacia.nombre,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET || 'dev-secret-key',
      expiresIn: '8h',
    });

    return {
      accessToken,
      expiresIn: 8 * 60 * 60,
      farmacia: {
        id: farmacia.id.toString(),
        codigo: farmacia.codigo,
        nombre: farmacia.nombre,
        organizacionId: farmacia.organizacionId,
      },
    };
  }

  async validatePayload(payload: FarmaciaJwtPayload) {
    if (payload?.type !== 'farmacia') return null;
    const farmacia = await this.prisma.farmacia.findFirst({
      where: { id: BigInt(payload.sub), organizacionId: payload.organizacionId, activo: true },
      select: { id: true, codigo: true, nombre: true, organizacionId: true, esInterna: true },
    });
    if (!farmacia || farmacia.esInterna) return null;
    return farmacia;
  }
}
