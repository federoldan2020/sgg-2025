import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  FarmaciaAuthService,
  FarmaciaJwtPayload,
} from '../farmacia-auth.service';

/**
 * Estrategia JWT específica para farmacias externas. Coexiste con la
 * estrategia `jwt` de usuarios — esta usa el namespace 'farmacia-jwt'.
 */
@Injectable()
export class FarmaciaJwtStrategy extends PassportStrategy(Strategy, 'farmacia-jwt') {
  constructor(private readonly farmaciaAuth: FarmaciaAuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-key',
    });
  }

  async validate(payload: FarmaciaJwtPayload) {
    const farmacia = await this.farmaciaAuth.validatePayload(payload);
    if (!farmacia) {
      throw new UnauthorizedException('Token de farmacia inválido o expirado');
    }
    return farmacia;
  }
}
