import { Prisma, PrismaClient } from '@prisma/client';

export type ReglaColateralCandidata = {
  id: bigint;
  parentescoId: bigint | null;
  cantidadDesde: number;
  cantidadHasta: number | null;
  vigenteDesde: Date;
  precioPorColateral: Prisma.Decimal | null;
  precioTotal: Prisma.Decimal | null;
};

/**
 * Elige la regla más específica para un parentesco y cantidad dados.
 * Orden de prioridad:
 *   1. Match exacto de `parentescoId` gana sobre comodín (null).
 *   2. Mayor `cantidadDesde` que aún cubra la cantidad.
 *   3. `vigenteDesde` más reciente.
 *   4. Mayor id.
 *
 * Devuelve `null` si ninguna regla matchea.
 */
export function seleccionarReglaJ38(
  reglas: ReglaColateralCandidata[],
  parentescoId: bigint,
  cantidad: number,
): ReglaColateralCandidata | null {
  const candidatas = reglas.filter(
    (r) =>
      (r.parentescoId === parentescoId || r.parentescoId === null) &&
      cantidad >= r.cantidadDesde &&
      (r.cantidadHasta == null || cantidad <= r.cantidadHasta),
  );
  if (!candidatas.length) return null;

  candidatas.sort((a, b) => {
    const aMatch = a.parentescoId === parentescoId ? 1 : 0;
    const bMatch = b.parentescoId === parentescoId ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    if (b.cantidadDesde !== a.cantidadDesde) return b.cantidadDesde - a.cantidadDesde;
    const ad = a.vigenteDesde.getTime();
    const bd = b.vigenteDesde.getTime();
    if (bd !== ad) return bd - ad;
    return Number(b.id - a.id);
  });

  return candidatas[0];
}

/**
 * Aplica el precio de una regla para la cantidad dada del tramo.
 * - `precioPorColateral` × cantidad si está seteado.
 * - `precioTotal` fijo si está seteado.
 * - Si ambos están seteados (no debería), prevalece `precioPorColateral`.
 */
export function aplicarPrecioRegla(
  regla: Pick<ReglaColateralCandidata, 'precioPorColateral' | 'precioTotal'>,
  cantidad: number,
): Prisma.Decimal {
  if (regla.precioPorColateral != null) {
    return new Prisma.Decimal(regla.precioPorColateral).mul(cantidad);
  }
  if (regla.precioTotal != null) return new Prisma.Decimal(regla.precioTotal);
  return new Prisma.Decimal(0);
}

/**
 * Calcula el total J38 para un afiliado a una fecha dada usando reglas
 * (incluye soporte para comodín de parentesco y precioPorColateral).
 *
 * Helper puro reutilizable desde cualquier servicio sin DI: pasa el cliente
 * Prisma como parámetro. El servicio canónico es `ColateralesCalculoService`,
 * los otros consumidores (suspensiones, etc.) llaman a este helper para no
 * crear dependencia entre módulos.
 */
export async function calcularJ38ParaAfiliado(
  prisma: PrismaClient | Prisma.TransactionClient,
  organizacionId: string,
  afiliadoId: bigint,
  at: Date,
): Promise<Prisma.Decimal> {
  let total = new Prisma.Decimal(0);

  const colats = await prisma.colateral.findMany({
    where: { afiliadoId, activo: true, esColateral: true },
    select: { parentescoId: true },
  });
  if (!colats.length) return total;

  const porParentesco = new Map<bigint, number>();
  for (const c of colats) {
    const key = BigInt(c.parentescoId);
    porParentesco.set(key, (porParentesco.get(key) ?? 0) + 1);
  }

  const reglas: ReglaColateralCandidata[] = await prisma.reglaPrecioColateral.findMany({
    where: {
      organizacionId,
      activo: true,
      vigenteDesde: { lte: at },
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: at } }],
    },
    select: {
      id: true,
      parentescoId: true,
      cantidadDesde: true,
      cantidadHasta: true,
      vigenteDesde: true,
      precioPorColateral: true,
      precioTotal: true,
    },
  });

  for (const [pid, cant] of porParentesco.entries()) {
    const ganadora = seleccionarReglaJ38(reglas, pid, cant);
    if (!ganadora) continue;
    total = total.plus(aplicarPrecioRegla(ganadora, cant));
  }

  return total;
}
