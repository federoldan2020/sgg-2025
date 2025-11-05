import { Module } from '@nestjs/common';
import { NovedadesController } from './novedades.controller';
import { NovedadesService } from './novedades.service';
import { PrismaService } from 'src/common/prisma.service';

@Module({
  controllers: [NovedadesController],
  providers: [NovedadesService, PrismaService],
  exports: [NovedadesService],
})
export class NovedadesModule {}
