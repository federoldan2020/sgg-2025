// src/modulos/colaterales/colaterales.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ColateralesController } from './colaterales.controller';
import { ColateralesService } from './colaterales.service';
import { ColateralesCalculoService } from './colaterales-calculo.service';
import { ColateralesReglasController } from './colaterales-reglas.controller';
import { ColateralesReglasService } from './colaterales-reglas.service';
import { ColateralesImportController } from './colaterales-import.controller';
import { ColateralesImportService } from './colaterales-import.service';
import { ClasificacionController } from './clasificacion.controller';
import { ClasificacionService } from './clasificacion.service';
import { AuditService } from '../../common/audit.service';
import { NovedadesModule } from '../novedades/novedades.module';

@Module({
  imports: [NovedadesModule],
  controllers: [
    ColateralesController,
    ColateralesReglasController,
    ColateralesImportController,
    ClasificacionController,
  ],
  providers: [
    AuditService,
    PrismaService,
    ColateralesService,
    ColateralesCalculoService,
    ColateralesReglasService,
    ColateralesImportService,
    ClasificacionService,
  ],
  exports: [ColateralesService, ClasificacionService],
})
export class ColateralesModule {}
