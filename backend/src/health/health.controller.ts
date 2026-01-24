// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { Public } from '../modulos/auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      // Base de datos Prisma
      () => this.prisma.isHealthy('database'),

      // Memoria (heap no debe exceder 300MB)
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),

      // Memoria RSS no debe exceder 500MB
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),

      // Disco debe tener al menos 1GB libre
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }

  @Get('ready')
  @Public()
  @HealthCheck()
  ready() {
    return this.health.check([() => this.prisma.isHealthy('database')]);
  }

  @Get('live')
  @Public()
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
