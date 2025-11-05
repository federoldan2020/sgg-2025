// antes: BullRootModuleOptions con defaultJobOptions
import type { BullRootModuleOptions } from '@nestjs/bullmq';

export function buildBullConfig(): BullRootModuleOptions {
  return {
    connection: {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: +(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: +(process.env.REDIS_DB || 0),
    },
    // 👇 quitar defaultJobOptions de aquí
    // defaultJobOptions: {...}  ❌
    // prefix: 'pgg2025', // opcional
  };
}
