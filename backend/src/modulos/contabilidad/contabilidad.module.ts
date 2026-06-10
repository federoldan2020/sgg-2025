// src/modulos/contabilidad/contabilidad.module.ts
import { Module } from '@nestjs/common';
import { ContabilidadService } from './contabilidad.service';
import { PlanController } from './plan.controller';
import { MapeosController } from './mapeos.controller';
import { AsientosController } from './asientos.controller';
import { PlanImportController } from './plan.import.controller';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [PlanController, MapeosController, AsientosController, PlanImportController],
  providers: [ContabilidadService, PrismaService],
  exports: [ContabilidadService], // para usar desde CajaController
})
export class ContabilidadModule {}
