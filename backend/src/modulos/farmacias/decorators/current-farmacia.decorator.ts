import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentFarmaciaPayload {
  id: bigint;
  codigo: string;
  nombre: string;
  organizacionId: string;
}

/**
 * Inyecta la farmacia autenticada por `FarmaciaJwtGuard`.
 *
 *   @Get(...)
 *   handler(@CurrentFarmacia() farmacia: CurrentFarmaciaPayload) { ... }
 *
 *   @Get(...)
 *   handler(@CurrentFarmacia('id') farmaciaId: bigint) { ... }
 */
export const CurrentFarmacia = createParamDecorator(
  (data: keyof CurrentFarmaciaPayload | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const farmacia = req.user as CurrentFarmaciaPayload | undefined;
    if (!farmacia) return undefined;
    return data ? farmacia[data] : farmacia;
  },
);
