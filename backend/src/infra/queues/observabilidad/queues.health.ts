// src/infra/queues/observabilidad/queues.health.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class QueuesHealthIndicator extends HealthIndicator {
  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    const client = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: +(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: +(process.env.REDIS_DB || 0),
      lazyConnect: true,
    });

    try {
      await client.connect();
      const pong = await client.ping();
      await client.quit();
      return this.getStatus(key, pong === 'PONG');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      try {
        await client.quit();
      } catch {
        /* noop */
      }
      return this.getStatus(key, false);
    }
  }
}
