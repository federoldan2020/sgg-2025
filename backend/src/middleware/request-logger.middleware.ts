import type { NextFunction, Request, Response } from 'express';

/**
 * Log de requests a la API para diagnóstico.
 * En POST /auth/login registra email y organizacionId (nunca la contraseña).
 */
export function requestLoggerMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const method = req.method;
  const path = req.path ?? req.url;
  const orgHeader = (req.headers['x-organizacion-id'] || req.headers['x-org-id']) as string | undefined;

  // Para login: logear qué se recibe (sin password)
  if (method === 'POST' && path === '/auth/login' && req.body && typeof req.body === 'object') {
    const body = req.body as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email : '(no string)';
    const orgBody = typeof body.organizacionId === 'string' ? body.organizacionId : undefined;
    console.log(
      `[API] POST /auth/login | email=${email} | body.organizacionId=${orgBody ?? '(vacío)'} | header X-Organizacion-ID=${orgHeader ?? '(no enviado)'}`,
    );
  } else {
    // Resto de requests: método y path
    console.log(`[API] ${method} ${path} ${orgHeader ? `| X-Org-Id=${orgHeader}` : ''}`);
  }

  next();
}
