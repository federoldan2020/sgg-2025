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
import { AuditService } from '../../common/audit.service';
import { NovedadesModule } from '../novedades/novedades.module';

@Module({
  imports: [NovedadesModule],
  controllers: [ColateralesController, ColateralesReglasController, ColateralesImportController],
  providers: [
    AuditService,
    PrismaService,
    ColateralesService,
    ColateralesCalculoService,
    ColateralesReglasService,
    ColateralesImportService,
  ],
  exports: [ColateralesService],
})
export class ColateralesModule {}
