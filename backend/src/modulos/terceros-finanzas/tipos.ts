// src/modulos/terceros-finanzas/tipos.ts
import {
  RolTercero,
  TipoComprobanteTercero,
  TipoImpuestoComprobante,
  TipoMovimientoTercero,
  OrigenMovimientoTercero,
} from '@prisma/client';

export const movimientoPorComprobante = (
  tipo: TipoComprobanteTercero,
): { tipo: TipoMovimientoTercero; origen: OrigenMovimientoTercero } => {
  switch (tipo) {
    case 'FACTURA':
    case 'PRESTACION':
      return { tipo: 'debito', origen: 'factura' };
    case 'NOTA_DEBITO':
      return { tipo: 'debito', origen: 'nota_debito' };
    case 'NOTA_CREDITO':
      return { tipo: 'credito', origen: 'nota_credito' };
    default:
      return { tipo: 'debito', origen: 'ajuste' };
  }
};

export const isProveedor = (rol: RolTercero) => rol === 'PROVEEDOR';
export const isPrestador = (rol: RolTercero) => rol === 'PRESTADOR';

export const ES_IMP_DEDUCIBLE = new Set<TipoImpuestoComprobante>([
  'PERCEPCION_IVA',
  'RETENCION_IVA',
  'RETENCION_GANANCIAS',
  'PERCEPCION_IIBB',
  'RETENCION_IIBB',
  'IMP_MUNICIPAL',
  'IMP_INTERNO',
  'OTRO',
  'GASTO_ADMINISTRATIVO',
]);
