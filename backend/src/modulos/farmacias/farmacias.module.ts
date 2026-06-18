import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaService } from '../../common/prisma.service';
import { FarmaciasService } from './farmacias.service';
import { FarmaciasController } from './farmacias.controller';
import { FarmaciaAuthService } from './farmacia-auth.service';
import { FarmaciaExternaController } from './farmacia-externa.controller';
import { FarmaciaJwtStrategy } from './strategies/farmacia-jwt.strategy';
import { OrdenesFarmaciaService } from './ordenes-farmacia.service';
import { OrdenesFarmaciaAdminController } from './ordenes-farmacia.controller';

@Module({
  imports: [
    PassportModule.register({}),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-key',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [
    FarmaciasController,
    FarmaciaExternaController,
    OrdenesFarmaciaAdminController,
  ],
  providers: [
    PrismaService,
    FarmaciasService,
    FarmaciaAuthService,
    FarmaciaJwtStrategy,
    OrdenesFarmaciaService,
  ],
  exports: [FarmaciasService, OrdenesFarmaciaService],
})
export class FarmaciasModule {}
