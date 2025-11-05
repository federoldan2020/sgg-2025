// src/infra/queues/base/base.processor.ts
import { WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';

export abstract class BaseProcessor extends WorkerHost {
  protected async safe<T>(job: Job, task: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const res = await task();
      // log mínimo (si usás Logger, reemplazá esto)

      console.log(`[${job.queueName}] ${job.name}#${job.id} OK in ${Date.now() - start}ms`);
      return res;
    } catch (err) {
      console.error(`[${job.queueName}] ${job.name}#${job.id} FAIL`, err?.message);
      throw err;
    }
  }
}
