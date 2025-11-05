// src/modulos/terceros-finanzas/comprobantes.dto.ts
import {
  RolTercero,
  TipoComprobanteTercero,
  ClaseComprobanteAFIP,
  TipoImpuestoComprobante,
} from '@prisma/client';

export type CrearComprobanteLineaDTO = {
  descripcion: string;
  cantidad: number | string;
  precioUnitario: number | string;
  alicuotaIVA?: number | string | null; // 0, 10.5, 21, 27 o null
};

export type CrearComprobanteImpuestoDTO = {
  tipo: TipoImpuestoComprobante;
  detalle?: string | null;
  jurisdiccion?: string | null;
  alicuota?: number | string | null;
  baseImponible?: number | string | null;
  importe: number | string;
};

export type CrearComprobanteDTO = {
  organizacionId: string;
  terceroId: string | number | bigint;
  rol: RolTercero;
  tipo: TipoComprobanteTercero;
  clase?: ClaseComprobanteAFIP | null;
  puntoVenta?: number | null;
  numero?: number | null;
  fecha?: string | Date | null;
  vencimiento?: string | Date | null;
  moneda?: string | null; // ARS por default
  tc?: number | string | null;
  cuitEmisor?: string | null;
  observaciones?: string | null;
  lineas: CrearComprobanteLineaDTO[];
  impuestos?: CrearComprobanteImpuestoDTO[]; // percepciones/retenciones/etc.
};
