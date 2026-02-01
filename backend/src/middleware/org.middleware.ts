// src/middleware/org.middleware.ts
import type { NextFunction, Request, Response } from 'express';
import { ForbiddenException } from '@nestjs/common';

const SUPERADMIN_ROLE = 'SUPERADMIN';

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

  // Si hay usuario autenticado, validar que organización coincida (salvo SUPERADMIN)
  const user = (req as any)?.user;
  const userOrg = user?.organizacionId as string | undefined;
  const isSuperadmin = Array.isArray(user?.roles) && user.roles.includes(SUPERADMIN_ROLE);

  if (!isSuperadmin && userOrg && req.organizacionId && req.organizacionId !== userOrg) {
    // Previene acceso cruzado entre tenants
    return next(new ForbiddenException('Organización del header no coincide con la del usuario'));
  }
  next();
}
