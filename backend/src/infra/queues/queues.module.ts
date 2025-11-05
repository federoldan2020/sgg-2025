// src/infra/queues/queues.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { buildBullConfig } from './queues.config';
import { QUEUE_NAMES } from './queues.constants';
import { PublicacionesProcessor } from './procesadores/publicaciones.processor';
import { PadronesProcessor } from './procesadores/padrones.processor';
import { QueuesHealthIndicator } from './observabilidad/queues.health';
import { PrismaService } from '../../common/prisma.service'; // ⬅️ Agregar
import { NovedadesModule } from 'src/modulos/novedades/novedades.module';

@Module({
  imports: [
    BullModule.forRoot(buildBullConfig()),
    BullModule.registerQueue({
      name: QUEUE_NAMES.COLATERALES,
      defaultJobOptions: {
        removeOnComplete: 2000,
        removeOnFail: 5000,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1500 },
      },
    }),
    BullModule.registerQueue({
      name: QUEUE_NAMES.PADRONES,
      defaultJobOptions: {
        removeOnComplete: 2000,
        removeOnFail: 5000,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1500 },
      },
    }),
    // ⬇️ NUEVO: habilita DI de NovedadesService SIN tocar su implementación
    NovedadesModule,
  ],
  providers: [
    PrismaService, // ⬅️ Necesario para inyección en processors
    PublicacionesProcessor,
    PadronesProcessor,
    QueuesHealthIndicator,
  ],
  exports: [BullModule, QueuesHealthIndicator],
})
export class QueuesModule {}
