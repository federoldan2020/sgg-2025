// src/servicios/movimientosAdmin.ts
//
// Cliente de los endpoints administrativos del ledger (Fase 3).
// Todos requieren rol ADMIN/SUPERADMIN.

import { api } from "@/servicios/api";

/* ===== Tipos ===== */

export type MovimientoPorRevisar = {
  id: string;
  fecha: string;
  naturaleza: "debito" | "credito";
  origen: string;
  concepto: string;
  importe: number;
  periodoContable: string | null;
  afiliado: {
    id: string;
    dni: string | null;
    apellidoNombre: string;
  };
  padron: {
    id: string | null;
    numero: string | null;
  };
  saldoPadronActual: number | null;
};

export type PorRevisarResp = {
  items: MovimientoPorRevisar[];
  total: number;
  page: number;
  pageSize: number;
};

export type RecalcAfiliadoResp = {
  afiliadoId: string;
  padrones: Array<{
    padronId: string | null;
    padronLabel: string | null;
    saldoActual: number;
    saldoCalculado: number;
    diferencia: number;
    movimientos: number;
    movimientosActualizados: number;
  }>;
  aplicado: boolean;
};

export type RecalcOrgResp = {
  afiliadosProcesados: number;
  padronesConDiferencia: number;
  movimientosActualizados: number;
  aplicado: boolean;
  divergencias: Array<{
    afiliadoId: string;
    padronId: string | null;
    saldoActual: number;
    saldoCalculado: number;
    diferencia: number;
  }>;
};

/* ===== API ===== */

export const movimientosAdmin = {
  porRevisar: (params: {
    afiliadoId?: string;
    padronId?: string;
    page?: number;
    pageSize?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.afiliadoId) qs.set("afiliadoId", params.afiliadoId);
    if (params.padronId) qs.set("padronId", params.padronId);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    const q = qs.toString();
    return api<PorRevisarResp>(
      `/admin/movimientos/por-revisar${q ? `?${q}` : ""}`,
    );
  },

  aceptarSaldoFavor: (id: string) =>
    api<{ ok: true }>(`/admin/movimientos/${id}/aceptar-saldo-favor`, {
      method: "POST",
    }),

  vincularObligacion: (id: string, obligacionId: string) =>
    api<{
      ok: true;
      obligacionSaldoFinal: number;
      obligacionEstado: string;
    }>(`/admin/movimientos/${id}/vincular-obligacion`, {
      method: "POST",
      body: JSON.stringify({ obligacionId }),
    }),

  anular: (id: string, motivo: string) =>
    api<{ ok: true; movimientoInversoId: string }>(
      `/admin/movimientos/${id}/anular`,
      {
        method: "POST",
        body: JSON.stringify({ motivo }),
      },
    ),

  recalcular: (params: { afiliadoId?: string; dryRun?: boolean }) =>
    api<RecalcAfiliadoResp | RecalcOrgResp>(
      "/admin/movimientos/recalcular-saldos",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    ),
};
