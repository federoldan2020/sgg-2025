// src/middleware/org.middleware.ts
import type { NextFunction, Request, Response } from 'express';

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
  next();
}
