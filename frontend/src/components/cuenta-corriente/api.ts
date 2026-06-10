import { api } from "@/servicios/api";
import type {
  AfiliadoSuggest,
  CtaCteResp,
  OrdenDetallesPagos,
  PadronLite,
} from "./types";

export const buscarAfiliados = (q: string) =>
  api<AfiliadoSuggest[]>(`/afiliados/suggest?q=${encodeURIComponent(q)}`);

export const padronesActivos = (afiliadoId: string) =>
  api<PadronLite[]>(`/padrones?afiliadoId=${encodeURIComponent(afiliadoId)}`);

export const listarMovimientos = (params: {
  afiliadoId: string;
  padronId?: string;
  take?: number;
  periodoContable?: string;
}): Promise<CtaCteResp> => {
  const qs = new URLSearchParams();
  qs.set("afiliadoId", params.afiliadoId);
  if (params.padronId) qs.set("padronId", params.padronId);
  if (params.take) qs.set("take", String(params.take));
  if (params.periodoContable) qs.set("periodoContable", params.periodoContable);
  return api<CtaCteResp>(`/movimientos?${qs.toString()}`);
};

export const obtenerDetallesPagosOrden = (
  ordenId: string,
): Promise<OrdenDetallesPagos> =>
  api<OrdenDetallesPagos>(`/ordenes/detalles-pagos/${ordenId}`);
