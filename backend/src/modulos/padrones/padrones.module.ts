// =============================================================
// src/padrones/padrones.module.ts
// =============================================================
import { Module } from '@nestjs/common';
import { PadronesController } from './padrones.controller';
import { PadronesService } from './padrones.service';
import { PrismaService } from '../../common/prisma.service';
import { NovedadesService } from '../novedades/novedades.service';

@Module({
  controllers: [PadronesController],
  providers: [PadronesService, PrismaService, NovedadesService],
  exports: [PadronesService],
})
export class PadronesModule {}
