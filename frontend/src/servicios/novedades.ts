import { api, API_URL } from "./api";

export type NovedadLote = {
  id: string;
  organizacionId: string;
  periodo: string;
  canal: "ESC";
  estado:
    | "borrador"
    | "enviado"
    | "parcialmente_conciliado"
    | "conciliado"
    | "anulado";
  generadoEn: string;
  generadoPorId: string | null;
  enviadoEn: string | null;
  enviadoPorId: string | null;
  conciliadoEn: string | null;
  anuladoEn: string | null;
  motivoAnulacion: string | null;
  archivoNombre: string | null;
  archivoHash: string | null;
  totalLineas: number;
  totalAfiliados: number;
  totalJ22: number;
  totalJ38: number;
  totalK16: number;
  totalJ17Altas: number;
  totalJ17Bajas: number;
  counts?: {
    items: number;
    obligacionesBloqueadas: number;
    bajasInformadas: number;
  };
};

export type NovedadLoteItem = {
  id: string;
  padronId: string;
  afiliadoId: string;
  centro: number | null;
  padron: string;
  tipoMovimiento: "alta" | "baja" | "mixto" | "k16_solo";
  lineaCompleta: string;
  valorJ17: number | null;
  valorJ22: number | null;
  valorJ38: number | null;
  valorK16: number | null;
  afiliado: { id: string; dni: string; apellido: string; nombre: string };
  k16Detalle: Array<{
    obligacionId: string;
    componente: "cuota_mes" | "saldo_arrastrado" | "interes";
    monto: number;
    periodoOrigen: string;
  }>;
};

export type BajaPendiente = {
  id: string;
  padronId: string;
  codigo: "PADRON_COMPLETO" | "J17" | "J22" | "J38" | "K16";
  motivo: string;
  observacion: string | null;
  fechaSolicitada: string;
  solicitadoPorId: string | null;
  padron: {
    id: string;
    padron: string;
    centro: number | null;
    afiliado: { id: string; dni: string; apellido: string; nombre: string } | null;
  };
};

export function listarLotes(limit = 20) {
  return api<NovedadLote[]>(`/novedades/lotes?limit=${limit}`);
}

export function generarBorrador(periodo: string, canal: "ESC" = "ESC") {
  return api<NovedadLote>("/novedades/generar", {
    method: "POST",
    body: JSON.stringify({ periodo, canal }),
  });
}

export function detalleLote(id: string | number) {
  return api<NovedadLote>(`/novedades/lotes/${id}`);
}

export function itemsLote(id: string | number) {
  return api<NovedadLoteItem[]>(`/novedades/lotes/${id}/items`);
}

export function marcarEnviado(id: string | number) {
  return api<NovedadLote>(`/novedades/lotes/${id}/marcar-enviado`, { method: "POST" });
}

export function anularLote(id: string | number, motivo: string) {
  return api<NovedadLote>(`/novedades/lotes/${id}/anular`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
}

export function listarBajasPendientes() {
  return api<BajaPendiente[]>("/novedades/bajas-pendientes");
}

// ─────────────────────────────────────────────────────────────────
// Novedades pendientes (operator-driven J17/J22/J38)
// ─────────────────────────────────────────────────────────────────

export type ConceptoNov = "J17" | "J22" | "J38";
export type TipoNov = "alta" | "baja" | "modificacion";
export type DestinoNov = "COMPUTOS" | "ANSES";
export type EstadoNov = "pendiente" | "enviada" | "cancelada";

export type NovedadPendiente = {
  id: string;
  organizacionId: string;
  padronId: string;
  afiliadoId: string;
  concepto: ConceptoNov;
  tipoMovimiento: TipoNov;
  destino: DestinoNov;
  valor: number | null;
  periodoObjetivo: string;
  estado: EstadoNov;
  origenEvento: string;
  observacion: string | null;
  creadoEn: string;
  creadoPorId: string | null;
  loteId: string | null;
  enviadaEn: string | null;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
  padron: { padron: string; centro: number | null; sistema: string | null };
  afiliado: { apellido: string; nombre: string; dni: string };
};

export type ListarPendientesParams = {
  estado?: EstadoNov;
  destino?: DestinoNov;
  concepto?: ConceptoNov;
  periodoObjetivo?: string;
  padronId?: string;
  take?: number;
  skip?: number;
};

export function listarPendientes(params: ListarPendientesParams = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v));
  });
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return api<{ items: NovedadPendiente[]; total: number }>(
    `/novedades/pendientes${suffix}`,
  );
}

export function crearPendienteManual(input: {
  padronId: string;
  afiliadoId: string;
  concepto: ConceptoNov;
  tipoMovimiento: TipoNov;
  destino: DestinoNov;
  valor?: number;
  periodoObjetivo: string;
  observacion?: string;
}) {
  return api<NovedadPendiente>("/novedades/pendientes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function cancelarPendiente(id: string, motivo: string) {
  return api<NovedadPendiente>(`/novedades/pendientes/${id}/cancelar`, {
    method: "PATCH",
    body: JSON.stringify({ motivo }),
  });
}

export function cancelarBaja(id: string | number, motivo: string) {
  return api(`/novedades/bajas/${id}/cancelar`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
}

/** Descarga el .txt del lote. */
export async function descargarTxt(id: string | number, nombre: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  const orgId = typeof window !== "undefined" ? localStorage.getItem("organizacionId") || "" : "";
  const res = await fetch(`${API_URL}/novedades/lotes/${id}/archivo`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(orgId ? { "X-Organizacion-ID": orgId } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
