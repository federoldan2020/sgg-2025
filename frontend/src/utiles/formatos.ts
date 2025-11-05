/* eslint-disable @typescript-eslint/no-explicit-any */
// ISO yyyy-mm-dd desde string | Date | objeto raro | null/undefined
export function fecha10(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') {
    // si ya es ISO o similar
    if (v.length >= 10) return v.slice(0, 10);
    // último intento: Date(v)
    const d = new Date(v as any);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  // Date nativo
  if (v instanceof Date) return v.toISOString().slice(0, 10);

  // Prisma/otros: probar toISOString, toDate, value, etc.
  const anyV = v as any;
  if (typeof anyV?.toISOString === 'function') return anyV.toISOString().slice(0, 10);
  if (anyV?.value && typeof anyV.value === 'string') {
    return anyV.value.slice(0, 10);
  }
  // último intento: construir Date
  const d = new Date(anyV);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

// Número desde number | string | Prisma.Decimal | objeto raro
export function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v);

  const anyV = v as any;
  if (anyV == null) return NaN;

  // Prisma.Decimal suele tener toNumber()
  if (typeof anyV.toNumber === 'function') {
    try { return anyV.toNumber(); } catch { /* ignore */ }
  }
  // Fallback genérico
  try {
    const s = typeof anyV.toString === 'function' ? anyV.toString() : String(anyV);
    return Number(s);
  } catch {
    return NaN;
  }
}

// Formato ARS básico para mostrar
export function mon(v: unknown): string {
  const n = num(v);
  if (!isFinite(n)) return '$ -';
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(n);
}