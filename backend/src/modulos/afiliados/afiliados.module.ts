// =============================================================
// src/afiliados/afiliados.module.ts
// =============================================================
import { Module } from '@nestjs/common';
import { AfiliadosController } from './afiliados.controller';
import { AfiliadosService } from './afiliados.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [AfiliadosController],
  providers: [AfiliadosService, PrismaService],
  exports: [AfiliadosService],
})
export class AfiliadosModule {}
