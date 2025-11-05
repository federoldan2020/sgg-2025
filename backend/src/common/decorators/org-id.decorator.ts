// src/common/decorators/org-id.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type OrgAwareReq = {
  organizacionId?: string;
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

export const OrgId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest<OrgAwareReq>();

  // leer de: middleware -> headers -> query
  const headerOrg =
    (req.headers?.['x-organizacion-id'] as string | undefined) ??
    (req.headers?.['x-org-id'] as string | undefined);

  const queryOrg = req.query?.['organizacionId'] as string | undefined;

  const orgId = req.organizacionId ?? headerOrg ?? queryOrg;

  // normalizar a string y evitar "unsafe return"
  return typeof orgId === 'string' ? orgId : '';
});
