// src/modulos/colaterales/colaterales.module.ts
import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ColateralesController } from './colaterales.controller';
import { ColateralesService } from './colaterales.service';
import { ColateralesCalculoService } from './colaterales-calculo.service';
import { NovedadesModule } from '../novedades/novedades.module'; // si ColateralesService encola novedades
import { ColateralesReglasController } from './colaterales-reglas.controller';
import { ColateralesReglasService } from './colaterales-reglas.service';

@Module({
  imports: [NovedadesModule],
  controllers: [ColateralesController, ColateralesReglasController],
  providers: [
    PrismaService,
    ColateralesService,
    ColateralesCalculoService,
    ColateralesReglasService,
  ],
  exports: [ColateralesService],
})
export class ColateralesModule {}
