import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';
import { orgMiddleware } from './middleware/org.middleware';
import { SerializeInterceptor } from './core/interceptores/serialize.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.enableCors();
  app.useGlobalInterceptors(new SerializeInterceptor());

  // Middleware de organización (multitenant) con validación contra usuario autenticado
  app.use(orgMiddleware as unknown as (req: Request, res: Response, next: NextFunction) => void);

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.log(`API escuchando en puerto ${port}`);
}

void bootstrap();
