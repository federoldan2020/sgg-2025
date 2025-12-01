// =============================================================
// src/afiliados/afiliados.module.ts
// =============================================================
import { Module } from '@nestjs/common';
import { AfiliadosController } from './afiliados.controller';
import { AfiliadosImportController } from './afiliados-import.controller';
import { AfiliadosService } from './afiliados.service';
import { AfiliadosImportService } from './afiliados-import.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [AfiliadosController, AfiliadosImportController],
  providers: [AfiliadosService, AfiliadosImportService, PrismaService],
  exports: [AfiliadosService],
})
export class AfiliadosModule {}
