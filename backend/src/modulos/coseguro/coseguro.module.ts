import { Module } from '@nestjs/common';
import { CoseguroController } from './coseguro.controller';
import { CoseguroService } from './coseguro.service';
import { PrismaService } from '../../common/prisma.service';
import { CoseguroReglasController } from './coseguro-reglas.controller';
import { CoseguroReglasService } from './coseguro-reglas.service';
import { CoseguroMarcadoInicialController } from './coseguro-marcado-inicial.controller';
import { AuditService } from '../../common/audit.service';
import { NovedadesModule } from '../novedades/novedades.module';

@Module({
  imports: [NovedadesModule],
  controllers: [
    CoseguroController,
    CoseguroReglasController,
    CoseguroMarcadoInicialController,
  ],
  providers: [CoseguroService, PrismaService, CoseguroReglasService, AuditService],
  exports: [CoseguroService],
})
export class CoseguroModule {}
