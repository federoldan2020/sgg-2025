// src/modulos/terceros-finanzas/ordenes-pago.dto.ts
import { MetodoPagoOP, RolTercero } from '@prisma/client';

export type CrearOrdenPagoMetodoDTO = {
  metodo: MetodoPagoOP;
  monto: number | string;
  ref?: string | null;
};

export type CrearOrdenPagoAplicacionDTO = {
  comprobanteId: string | number | bigint;
  montoAplicado: number | string;
};

export type CrearOrdenPagoDTO = {
  organizacionId: string;
  terceroId: string | number | bigint;
  rol: RolTercero;
  fecha?: string | Date | null;
  observaciones?: string | null;
  metodos: CrearOrdenPagoMetodoDTO[];
  aplicaciones: CrearOrdenPagoAplicacionDTO[];
};
