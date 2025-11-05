// src/infra/queues/productores/publicaciones.producer.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue, JobsOptions, Job } from 'bullmq';
import { JOB_NAMES, QUEUE_NAMES } from '../queues.constants';

@Injectable()
export class PublicacionesProducer {
  constructor(
    @InjectQueue(QUEUE_NAMES.COLATERALES)
    private readonly colas: Queue,
  ) {}

  async encolarRecalcPublicacion(
    organizacionId: string,
    publicacionId: string,
    opts?: JobsOptions,
  ): Promise<Job> {
    const job = await this.colas.add(
      JOB_NAMES.RECALC_PUBLICACION,
      { organizacionId, publicacionId },
      {
        jobId: `pub:${organizacionId}:${publicacionId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1500 },
        ...opts,
      },
    );
    return job;
  }
}
