import type { Request } from 'express';

export function ensureOrg(req: Request): string {
  const org = req.organizacionId;
  if (!org) throw new Error('Falta organización');
  return org;
}
