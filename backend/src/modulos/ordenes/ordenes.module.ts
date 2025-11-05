import { Module } from '@nestjs/common';
import { OrdenesController } from './ordenes.controller';
import { OrdenesService } from './ordenes.service';
import { PrismaService } from 'src/common/prisma.service';
import { MovimientosModule } from '../movimientos/movimientos.module';

@Module({
  imports: [MovimientosModule], // <- IMPORTANTE
  controllers: [OrdenesController],
  providers: [OrdenesService, PrismaService],
  exports: [OrdenesService],
})
export class OrdenesModule {}
