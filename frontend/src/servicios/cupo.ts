import { api } from "./api";

export type DetalleOrdenAbierta = {
  ordenId: string;
  fechaAlta: string;
  cantidadCuotas: number | null;
  comercioRazonSocial: string | null;
  importeTotal: number;
  saldoTotal: number;
  cuotasPendientes: number;
};

export type CupoAfiliado = {
  organizacionId: string;
  afiliadoId: string;
  cupoTotal: number;
  cupoUsado: number;
  cupoDisponible: number;
  porcentajeUsado: number;
  cantidadOrdenesAbiertas: number;
  detalleOrdenes: DetalleOrdenAbierta[];
};

export function getCupoAfiliado(afiliadoId: string | number) {
  return api<CupoAfiliado>(`/afiliados/${afiliadoId}/cupo`);
}
