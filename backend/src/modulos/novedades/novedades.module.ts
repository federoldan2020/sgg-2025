import { Module } from '@nestjs/common';
import { NovedadesController } from './novedades.controller';
import { NovedadesService } from './novedades.service';
import { PrismaService } from 'src/common/prisma.service';
import { MovimientosModule } from '../movimientos/movimientos.module';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';

@Module({
  imports: [MovimientosModule, ContabilidadModule],
  controllers: [NovedadesController],
  providers: [NovedadesService, PrismaService],
  exports: [NovedadesService],
})
export class NovedadesModule {}
