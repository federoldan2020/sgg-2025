// =============================================================
// src/padrones/padrones.module.ts
// =============================================================
import { Module } from '@nestjs/common';
import { PadronesController } from './padrones.controller';
import { PadronesService } from './padrones.service';
import { PrismaService } from '../../common/prisma.service';
import { PadronesImportController } from './padrones-import.controller';
import { PadronesImportService } from './padrones-import.service';
import { NovedadesModule } from '../novedades/novedades.module';

@Module({
  imports: [NovedadesModule],
  controllers: [PadronesController, PadronesImportController],
  providers: [PadronesService, PrismaService, PadronesImportService],
  exports: [PadronesService, PadronesImportService],
})
export class PadronesModule {}
