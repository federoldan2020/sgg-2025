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

// Alias más descriptivo
export const formatearMoneda = mon;

/**
 * Formatea una fecha en formato argentino: dd/mm/aaaa
 * @param fecha - Date, string ISO (yyyy-mm-dd), o null/undefined
 * @returns String en formato dd/mm/aaaa o '' si la fecha es inválida
 */
export function formatearFechaArgentina(fecha: Date | string | null | undefined): string {
  if (!fecha) return '';
  
  let date: Date;
  if (fecha instanceof Date) {
    date = fecha;
  } else if (typeof fecha === 'string') {
    // Intentar parsear como ISO (yyyy-mm-dd) o fecha estándar
    date = new Date(fecha);
  } else {
    return '';
  }
  
  if (isNaN(date.getTime())) return '';
  
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  
  return `${dia}/${mes}/${anio}`;
}

/**
 * Formatea un período en formato argentino: mm/aa o mm/aaaa
 * @param periodo - String en formato YYYY-MM o YYYYMM o MM/YYYY, o null/undefined
 * @returns String en formato mm/aa o mm/aaaa, o '' si el período es inválido
 */
export function formatearPeriodoArgentina(periodo: string | null | undefined): string {
  if (!periodo) return '';
  
  const str = periodo.trim();
  
  // Formato YYYY-MM (ej: "2026-01")
  const match1 = str.match(/^(\d{4})-(\d{2})$/);
  if (match1) {
    const [, anio, mes] = match1;
    // Si el año es >= 2000, mostrar mm/aa, sino mm/aaaa
    const anioNum = parseInt(anio, 10);
    if (anioNum >= 2000) {
      return `${mes}/${anio.slice(-2)}`;
    }
    return `${mes}/${anio}`;
  }
  
  // Formato YYYYMM (ej: "202601")
  const match2 = str.match(/^(\d{4})(\d{2})$/);
  if (match2) {
    const [, anio, mes] = match2;
    const anioNum = parseInt(anio, 10);
    if (anioNum >= 2000) {
      return `${mes}/${anio.slice(-2)}`;
    }
    return `${mes}/${anio}`;
  }
  
  // Formato MM/YYYY o MM/YY (ya está en formato argentino, pero lo normalizamos)
  const match3 = str.match(/^(\d{2})\/(\d{2,4})$/);
  if (match3) {
    const [, mes, anio] = match3;
    if (anio.length === 2) {
      return `${mes}/${anio}`;
    }
    // Si tiene 4 dígitos y es >= 2000, mostrar mm/aa
    const anioNum = parseInt(anio, 10);
    if (anioNum >= 2000) {
      return `${mes}/${anio.slice(-2)}`;
    }
    return `${mes}/${anio}`;
  }
  
  return str; // Si no coincide, devolver tal cual
}

/**
 * Convierte una fecha en formato argentino (dd/mm/aaaa) a formato ISO (yyyy-mm-dd)
 * @param fechaArg - String en formato dd/mm/aaaa
 * @returns String en formato yyyy-mm-dd o '' si la fecha es inválida
 */
export function fechaArgentinaAISO(fechaArg: string | null | undefined): string {
  if (!fechaArg) return '';
  
  const str = fechaArg.trim();
  
  // Formato dd/mm/aaaa o dd/mm/aa
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const [, dia, mes, anio] = match;
    let anioCompleto = anio;
    
    // Si el año tiene 2 dígitos, asumimos años 2000-2099
    if (anio.length === 2) {
      const anioNum = parseInt(anio, 10);
      // Si es >= 30, asumimos 1900, sino 2000
      anioCompleto = anioNum >= 30 ? `19${anio}` : `20${anio}`;
    }
    
    const diaNum = parseInt(dia, 10);
    const mesNum = parseInt(mes, 10);
    const anioNum = parseInt(anioCompleto, 10);
    
    // Validar rango básico
    if (diaNum < 1 || diaNum > 31 || mesNum < 1 || mesNum > 12 || anioNum < 1900 || anioNum > 2100) {
      return '';
    }
    
    // Crear Date para validar fecha completa
    const date = new Date(anioNum, mesNum - 1, diaNum);
    if (
      date.getFullYear() !== anioNum ||
      date.getMonth() !== mesNum - 1 ||
      date.getDate() !== diaNum
    ) {
      return ''; // Fecha inválida
    }
    
    return `${anioCompleto}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
  }
  
  // Si ya está en formato ISO, devolver tal cual
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  
  return '';
}

/**
 * Convierte un período en formato argentino (mm/aa o mm/aaaa) a formato ISO (YYYY-MM)
 * @param periodoArg - String en formato mm/aa o mm/aaaa
 * @returns String en formato YYYY-MM o '' si el período es inválido
 */
export function periodoArgentinaAISO(periodoArg: string | null | undefined): string {
  if (!periodoArg) return '';
  
  const str = periodoArg.trim();
  
  // Formato mm/aa o mm/aaaa
  const match = str.match(/^(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const [, mes, anio] = match;
    let anioCompleto = anio;
    
    // Si el año tiene 2 dígitos, asumimos años 2000-2099
    if (anio.length === 2) {
      const anioNum = parseInt(anio, 10);
      // Si es >= 30, asumimos 1900, sino 2000
      anioCompleto = anioNum >= 30 ? `19${anio}` : `20${anio}`;
    }
    
    const mesNum = parseInt(mes, 10);
    const anioNum = parseInt(anioCompleto, 10);
    
    // Validar rango
    if (mesNum < 1 || mesNum > 12 || anioNum < 1900 || anioNum > 2100) {
      return '';
    }
    
    return `${anioCompleto}-${mes.padStart(2, '0')}`;
  }
  
  // Si ya está en formato ISO, devolver tal cual
  if (/^\d{4}-\d{2}$/.test(str)) {
    return str;
  }
  
  return '';
}