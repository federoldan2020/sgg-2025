// src/servicios/cajaService.ts
import { api } from "@/servicios/api";

/* ===== Tipos mínimos del front ===== */
export type EstadoCaja = {
  abierta: boolean;
  cajaId: string | null;
  sede: string | null;
};

export type MetodoPagoReq = {
  metodo: "efectivo" | "tarjeta" | "mercadopago" | "otro";
  monto: number;
  ref?: string | null;
};

export type AplicacionReq = {
  obligacionId?: number;
  cuotaId?: number;
  monto: number;
};

export type CobrarReq = {
  cajaId: number;
  afiliadoId: number;
  metodos: MetodoPagoReq[];
  aplicaciones: AplicacionReq[];
};

export type CobrarResp = { id: number | string; total: number | string };

export type CierreItem = {
  metodo: string | null;
  declarado: number;
  teorico: number;
};

export type AfiliadoSuggest = { id: string; dni: string; display: string };
export type ObligPend = {
  id: string;
  obligacionId?: string;
  cuotaId?: string;
  ordenId?: string;
  tipo?: 'obligacion' | 'cuota';
  padronLabel: string;
  concepto: string;
  saldo: number;
  periodo?: string;
  monto?: number;
};

/* ===== Servicio ===== */
export const cajaService = {
  // Estado/flujo
  estado: () => api<EstadoCaja>("/caja/estado"),
  abrir: (sede = "Central") =>
    api<{ id: string | number }>("/caja/abrir", {
      method: "POST",
      body: JSON.stringify({ sede }),
    }),

  // Cobros
  cobrar: (payload: CobrarReq) =>
    api<CobrarResp>("/caja/cobrar", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Cierre (lote por método)
  cerrarLote: (cajaId: string | number, items: CierreItem[]) =>
    api<{ diff: number; asientoId: string | null; ok?: boolean }>(
      "/caja/cerrar",
      {
        method: "POST",
        body: JSON.stringify({
          items,
          referenciaId: `caja-${cajaId}`,
          descripcion: `Cierre de caja ${cajaId}`,
        }),
      }
    ),

  // Auxiliares (si ya existen estos endpoints en tu back)
  suggestAfiliados: (q: string) =>
    api<AfiliadoSuggest[]>(`/afiliados/suggest?q=${encodeURIComponent(q)}`),

  pendientesAfiliado: (afiliadoId: string, padronId?: string) => {
    const params = new URLSearchParams({ afiliadoId });
    if (padronId) params.set('padronId', padronId);
    return api<ObligPend[]>(`/obligaciones/pendientes?${params.toString()}`);
  },
  
  padronesAfiliado: (afiliadoId: string) =>
    api<Array<{ id: string; padron: string | null; sistema: string | null; centro: number | null }>>(
      `/padrones?afiliadoId=${encodeURIComponent(afiliadoId)}`
    ),
};
