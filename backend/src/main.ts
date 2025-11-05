import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';
import { SerializeInterceptor } from './core/interceptores/serialize.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.enableCors();
  app.useGlobalInterceptors(new SerializeInterceptor());

  app.use((req: Request, _res: Response, next: NextFunction) => {
    const headerName = process.env.TENANT_HEADER || 'X-Organizacion-ID';
    req.organizacionId = req.header(headerName) ?? undefined;
    next();
  });

  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.log(`API escuchando en puerto ${port}`);
}

void bootstrap();
