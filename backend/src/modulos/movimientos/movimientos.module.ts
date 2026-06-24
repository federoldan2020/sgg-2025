import { Module } from '@nestjs/common';
import { MovimientosController } from './movimientos.controller';
import { MovimientosAdminController } from './movimientos-admin.controller';
import { MovimientosService } from './movimientos.service';
import { PrismaService } from 'src/common/prisma.service';
import { AuditService } from 'src/common/audit.service';

@Module({
  controllers: [MovimientosController, MovimientosAdminController],
  providers: [MovimientosService, PrismaService, AuditService],
  exports: [MovimientosService],
})
export class MovimientosModule {}
