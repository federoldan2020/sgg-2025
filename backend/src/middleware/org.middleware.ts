// src/middleware/org.middleware.ts
import type { NextFunction, Request, Response } from 'express';
import { ForbiddenException } from '@nestjs/common';

export function orgMiddleware(
  req: Request & { organizacionId?: string },
  _res: Response,
  next: NextFunction,
) {
  req.organizacionId =
    (req.headers['x-organizacion-id'] as string) ||
    (req.headers['x-org-id'] as string) ||
    (req.query['organizacionId'] as string) ||
    req.organizacionId;

  // Si hay usuario autenticado, validar que organización coincida
  const userOrg = (req as any)?.user?.organizacionId as string | undefined;
  if (userOrg && req.organizacionId && req.organizacionId !== userOrg) {
    // Previene acceso cruzado entre tenants
    return next(new ForbiddenException('Organización del header no coincide con la del usuario'));
  }
  next();
}
