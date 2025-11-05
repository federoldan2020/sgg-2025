// src/servicios/ordenes.api.ts
import { api } from "@/servicios/api";

export type AfiliadoLite = {
  id: string;
  nombre?: string;
  apellido?: string;
  dni?: string;
};
export type ComercioLite = { id: string; codigo: string; razonSocial: string };
export type PadronLite = { id: string; codigo?: string; descripcion?: string };

export async function buscarAfiliados(q: string) {
  const url = `/afiliados/buscar?q=${encodeURIComponent(q)}`;
  return api<AfiliadoLite[]>(url, { method: "GET" });
}

export async function padronesActivos(afiliadoId: string) {
  const url = `/afiliados/${encodeURIComponent(
    afiliadoId
  )}/padrones-activos?afiliadoId=${encodeURIComponent(afiliadoId)}`;
  return api<PadronLite[]>(url, { method: "GET" });
}

export async function buscarComercios(q: string) {
  const url = `/comercios?q=${encodeURIComponent(q)}`;
  return api<ComercioLite[]>(url, { method: "GET" });
}

export type PreviewCuota = {
  numero: number;
  periodoVenc: string;
  importe: string;
};
export type PreviewOrdenResp = {
  afiliadoId: string;
  padronId: string;
  comercioId: string;
  descripcion: string;
  importeTotal: string;
  cantidadCuotas: number;
  periodoPrimera: string;
  cuotas: PreviewCuota[];
};

export async function previewOrden(payload: {
  afiliadoId: string;
  padronId: string;
  comercioId: string;
  descripcion: string;
  importeTotal: number;
  cantidadCuotas: number;
  periodoPrimera?: string;
}) {
  return api<PreviewOrdenResp>("/ordenes/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function crearOrden(payload: {
  afiliadoId: string;
  padronId: string;
  comercioId: string;
  descripcion: string;
  importeTotal: number;
  enCuotas: boolean;
  cantidadCuotas: number;
  periodoPrimera?: string;
}) {
  return api<{ id: string | number }>("/ordenes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
