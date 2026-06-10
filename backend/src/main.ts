import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';
import { requestLoggerMiddleware } from './middleware/request-logger.middleware';
import { orgMiddleware } from './middleware/org.middleware';
import { SerializeInterceptor } from './core/interceptores/serialize.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Validación global: whitelist quita propiedades no declaradas en el DTO (reduce superficie de ataque)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const staticOrigins = new Set<string>([
    'http://localhost:3010',
    'http://localhost:3000',
    'http://localhost:3002',
    'https://udap.fourdev.com.ar',
    'https://www.udap.fourdev.com.ar',
  ]);

  if (process.env.FRONTEND_URL) {
    staticOrigins.add(process.env.FRONTEND_URL.trim());
  }

  if (process.env.CORS_ORIGINS) {
    for (const o of process.env.CORS_ORIGINS.split(',')) {
      const trimmed = o.trim();
      if (trimmed) staticOrigins.add(trimmed);
    }
  }

  const isDev = process.env.NODE_ENV !== 'production';

  app.enableCors({
    origin: (origin, callback) => {
      // Postman, curl, server-side
      if (!origin) {
        callback(null, true);
        return;
      }
      if (staticOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      if (
        isDev &&
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Organizacion-ID',
      'X-Org-Id',
    ],
    optionsSuccessStatus: 204,
  });
  app.useGlobalInterceptors(new SerializeInterceptor());

  // Log de requests (método, path; en login: email y organizacionId recibidos)
  app.use(requestLoggerMiddleware as unknown as (req: Request, res: Response, next: NextFunction) => void);

  // Middleware de organización (multitenant) con validación contra usuario autenticado
  app.use(orgMiddleware as unknown as (req: Request, res: Response, next: NextFunction) => void);

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.log(`API escuchando en puerto ${port}`);
}

void bootstrap();
