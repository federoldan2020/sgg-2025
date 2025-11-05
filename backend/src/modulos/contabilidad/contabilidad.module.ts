// src/modulos/contabilidad/contabilidad.module.ts
import { Module } from '@nestjs/common';
import { ContabilidadService } from './contabilidad.service';
import { PlanController } from './plan.controller';
import { MapeosController } from './mapeos.controller';
import { AsientosController } from './asientos.controller';
import { PlanImportController } from './plan.import.controller';

@Module({
  controllers: [PlanController, MapeosController, AsientosController, PlanImportController],
  providers: [ContabilidadService],
  exports: [ContabilidadService], // para usar desde CajaController
})
export class ContabilidadModule {}
