import { Module } from '@nestjs/common';
import { PublicacionesController } from './publicaciones.controller';
import { PublicacionesService } from './publicaciones.service';
import { QueuesModule } from '../../infra/queues/queues.module';
import { PrismaService } from '../../common/prisma.service';

@Module({
  imports: [QueuesModule],
  controllers: [PublicacionesController],
  providers: [PublicacionesService, PrismaService],
  exports: [PublicacionesService],
})
export class PublicacionesModule {}
