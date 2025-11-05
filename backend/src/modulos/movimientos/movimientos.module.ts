import { Module } from '@nestjs/common';
import { MovimientosController } from './movimientos.controller';
import { MovimientosService } from './movimientos.service';
import { PrismaService } from 'src/common/prisma.service';

@Module({
  controllers: [MovimientosController],
  providers: [MovimientosService, PrismaService],
  exports: [MovimientosService],
})
export class MovimientosModule {}
