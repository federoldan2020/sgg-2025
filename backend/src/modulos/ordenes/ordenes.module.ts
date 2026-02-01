import { Module } from '@nestjs/common';
import { OrdenesController } from './ordenes.controller';
import { OrdenesService } from './ordenes.service';
import { PrismaService } from 'src/common/prisma.service';
import { MovimientosModule } from '../movimientos/movimientos.module';
import { AuditService } from '../../common/audit.service';

@Module({
  imports: [MovimientosModule],
  controllers: [OrdenesController],
  providers: [OrdenesService, PrismaService, AuditService],
  exports: [OrdenesService],
})
export class OrdenesModule {}
