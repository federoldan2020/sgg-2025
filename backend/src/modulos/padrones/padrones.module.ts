// =============================================================
// src/padrones/padrones.module.ts
// =============================================================
import { Module } from '@nestjs/common';
import { PadronesController } from './padrones.controller';
import { PadronesService } from './padrones.service';
import { PrismaService } from '../../common/prisma.service';
import { PadronesImportController } from './padrones-import.controller';
import { PadronesImportService } from './padrones-import.service';
import { AuditService } from '../../common/audit.service';
import { NovedadesModule } from '../novedades/novedades.module';

@Module({
  imports: [NovedadesModule],
  controllers: [PadronesController, PadronesImportController],
  providers: [PadronesService, PrismaService, PadronesImportService, AuditService],
  exports: [PadronesService, PadronesImportService],
})
export class PadronesModule {}
