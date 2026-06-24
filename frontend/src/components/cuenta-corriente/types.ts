export type AfiliadoSuggest = {
  id: string;
  dni: string;
  display: string;
};

export type PadronLite = {
  id: string;
  padron: string;
  afiliadoId: string;
  activo: boolean;
  sistema: string | null;
  saldo: string;
  cupo: string;
};

export type Movimiento = {
  id: string;
  fecha: string;
  naturaleza: "debito" | "credito";
  origen: string;
  concepto: string;
  importe: string | number;
  padronId?: string | null;
  obligacionId?: string | null;
  ordenId?: string | null;
  cuotaId?: string | null;
  pagoId?: string | null;
  saldoPosterior?: string | number | null;
  saldoPendiente?: string | number | null;
  asientoId?: string | null;
  comprobanteId?: string | null;
  numeroRecibo?: string | null;
};

export type CtaCteResp = {
  movimientos: Movimiento[];
  saldoFinal: number;
};

export type PagoDetalle = {
  id: string;
  fecha: string;
  importe: number;
  concepto: string;
  pagoId?: string | null;
  pagoFecha?: string | null;
  pagoTotal?: number | null;
  origen?: string | null;
  periodoContable?: string | null;
};

export type CuotaDetalle = {
  id: string;
  numero: number;
  periodoVenc: string;
  importe: number;
  cancelado: number;
  saldo: number;
  estado: string;
  totalPagado: number;
  porcentajePagado: number;
  estadoCalculado: "pagada" | "parcialmente_pagada" | "pendiente";
  pagos: PagoDetalle[];
};

export type OrdenDetallesPagos = {
  orden: {
    id: string;
    descripcion: string;
    fechaAlta: string;
    importeTotal: number;
    saldoTotal: number;
    cantidadCuotas: number;
    estado: string;
    totalPagado: number;
    porcentajePagado: number;
  };
  cuotas: CuotaDetalle[];
};
