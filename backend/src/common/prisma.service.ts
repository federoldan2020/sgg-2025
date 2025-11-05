// =============================================================
// src/common/prisma.service.ts
// =============================================================
import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  // No async => se evita require-await; usamos process.on en vez de $on
  enableShutdownHooks(app: INestApplication): void {
    // Cierre ordenado cuando el proceso termina naturalmente
    process.on('beforeExit', async () => {
      await app.close();
    });
    // Cierre por señales típicas de contenedores/PM2/systemd
    process.once('SIGINT', async () => {
      await app.close();
    });
    process.once('SIGTERM', async () => {
      await app.close();
    });
  }
}
