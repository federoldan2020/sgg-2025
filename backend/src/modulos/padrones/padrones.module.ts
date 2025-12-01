// =============================================================
// src/padrones/padrones.module.ts
// =============================================================
import { Module } from '@nestjs/common';
import { PadronesController } from './padrones.controller';
import { PadronesService } from './padrones.service';
import { PrismaService } from '../../common/prisma.service';
import { PadronesImportController } from './padrones-import.controller';
import { PadronesImportService } from './padrones-import.service';
import { NovedadesService } from '../novedades/novedades.service';

@Module({
  controllers: [PadronesController, PadronesImportController],
  providers: [PadronesService, PrismaService, NovedadesService, PadronesImportService],
  exports: [PadronesService, PadronesImportService],
})
export class PadronesModule {}
