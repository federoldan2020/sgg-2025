import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ReintegrosController } from './reintegros.controller';
import { ReintegrosService } from './reintegros.service';
import { PrestacionesController } from './prestaciones.controller';
import { PrestacionesService } from './prestaciones.service';
import { TercerosFinanzasModule } from '../terceros-finanzas/terceros-finanzas.module';
import { ImpresionModule } from '../impresion/impresion.module';

@Module({
  imports: [TercerosFinanzasModule, ImpresionModule],
  controllers: [ReintegrosController, PrestacionesController],
  providers: [ReintegrosService, PrestacionesService, PrismaService],
})
export class ReintegrosModule {}
