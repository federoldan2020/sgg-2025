import { Module } from '@nestjs/common';
import { NovedadesController } from './novedades.controller';
import { NovedadesService } from './novedades.service';
import { NovedadesPendientesController } from './novedades-pendientes.controller';
import { NovedadesPendientesService } from './novedades-pendientes.service';
import { PrismaService } from '../../common/prisma.service';
import { AuditService } from '../../common/audit.service';

@Module({
  controllers: [NovedadesController, NovedadesPendientesController],
  providers: [
    NovedadesService,
    NovedadesPendientesService,
    PrismaService,
    AuditService,
  ],
  exports: [NovedadesService, NovedadesPendientesService],
})
export class NovedadesModule {}
