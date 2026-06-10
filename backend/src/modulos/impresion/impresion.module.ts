// src/modulos/impresion/impresion.module.ts
import { Module } from '@nestjs/common';
import { ImpresionController } from './impresion.controller';
import { ImpresionService } from './impresion.service';
import { ComprobantesImpresosController } from './comprobantes-impresos.controller';
import { ComprobantesImpresosService } from './comprobantes-impresos.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [ImpresionController, ComprobantesImpresosController],
  providers: [ImpresionService, ComprobantesImpresosService, PrismaService],
  exports: [ImpresionService],
})
export class ImpresionModule {}
