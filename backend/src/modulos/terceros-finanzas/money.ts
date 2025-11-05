// src/modulos/terceros-finanzas/money.ts
import { Prisma } from '@prisma/client';

export const D = (v?: number | string | null) =>
  v == null || v === '' ? new Prisma.Decimal(0) : new Prisma.Decimal(v);

export const add = (a: Prisma.Decimal, b: Prisma.Decimal) => a.add(b);
export const sub = (a: Prisma.Decimal, b: Prisma.Decimal) => a.sub(b);
export const gt0 = (a: Prisma.Decimal) => a.greaterThan(0);
