import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';
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

  app.enableCors({
    origin: [
      'http://localhost:3010',
      'http://localhost:3000',
      'https://udap.fourdev.com.ar',
      'https://www.udap.fourdev.com.ar',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Organizacion-ID', 'X-Org-Id'],
  });
  app.useGlobalInterceptors(new SerializeInterceptor());

  // Middleware de organización (multitenant) con validación contra usuario autenticado
  app.use(orgMiddleware as unknown as (req: Request, res: Response, next: NextFunction) => void);

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.log(`API escuchando en puerto ${port}`);
}

void bootstrap();
