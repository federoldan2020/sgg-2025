import { api } from "./api";

// =============================================================================
// Reglas de cobertura (cupo de órdenes de farmacia por mes)
// =============================================================================

export type ReglaCobertura = {
  id: string;
  organizacionId: string;
  ordenesPorMes: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
};

export function listarReglasCobertura() {
  return api<ReglaCobertura[]>("/parametricos/reglas/cobertura");
}

export function obtenerReglaCoberturaVigente(fecha?: string) {
  const qs = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  return api<ReglaCobertura | null>(`/parametricos/reglas/cobertura/vigente${qs}`);
}

export function crearReglaCobertura(body: {
  ordenesPorMes: number;
  vigenteDesde: string;
  vigenteHasta?: string | null;
  activo?: boolean;
}) {
  return api<ReglaCobertura>("/parametricos/reglas/cobertura", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function actualizarReglaCobertura(
  id: string,
  body: {
    ordenesPorMes?: number;
    vigenteHasta?: string | null;
    activo?: boolean;
  },
) {
  return api<ReglaCobertura>(`/parametricos/reglas/cobertura/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function eliminarReglaCobertura(id: string) {
  return api(`/parametricos/reglas/cobertura/${id}`, { method: "DELETE" });
}

// =============================================================================
// Reglas de clasificación de integrantes (GF / J38 / SIN_COBERTURA)
// =============================================================================

export type ClasifResultado = "GF" | "J38" | "SIN_COBERTURA";

export type ReglaClasificacion = {
  id: string;
  organizacionId: string;
  parentescoId: string | null;
  parentesco?: {
    id: string;
    codigo: number;
    descripcion: string;
  } | null;
  sexoTitular: "M" | "F" | "X" | null;
  edadDesde: number | null;
  edadHasta: number | null;
  requiereEstudiante: boolean | null;
  requiereAportes: boolean | null;
  requiereDiscapacidad: boolean | null;
  resultado: ClasifResultado;
  prioridad: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
  descripcion: string | null;
};

export function listarReglasClasificacion() {
  return api<ReglaClasificacion[]>("/parametricos/reglas/clasificacion");
}

export function crearReglaClasificacion(body: {
  parentescoCodigo?: number | null;
  sexoTitular?: "M" | "F" | "X" | null;
  edadDesde?: number | null;
  edadHasta?: number | null;
  requiereEstudiante?: boolean | null;
  requiereAportes?: boolean | null;
  requiereDiscapacidad?: boolean | null;
  resultado: ClasifResultado;
  prioridad: number;
  vigenteDesde: string;
  vigenteHasta?: string | null;
  activo?: boolean;
  descripcion?: string | null;
}) {
  return api<ReglaClasificacion>("/parametricos/reglas/clasificacion", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function actualizarReglaClasificacion(
  id: string,
  body: Partial<
    Omit<
      Parameters<typeof crearReglaClasificacion>[0],
      "vigenteDesde" | "resultado" | "prioridad"
    >
  > & {
    resultado?: ClasifResultado;
    prioridad?: number;
    vigenteHasta?: string | null;
    descripcion?: string | null;
  },
) {
  return api<ReglaClasificacion>(`/parametricos/reglas/clasificacion/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function toggleReglaClasificacion(id: string, activo: boolean) {
  return api(`/parametricos/reglas/clasificacion/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ activo }),
  });
}

export function eliminarReglaClasificacion(id: string) {
  return api(`/parametricos/reglas/clasificacion/${id}`, { method: "DELETE" });
}

export function reordenarReglasClasificacion(orden: { id: string; prioridad: number }[]) {
  return api(`/parametricos/reglas/clasificacion/reordenar`, {
    method: "PATCH",
    body: JSON.stringify({ orden }),
  });
}

// =============================================================================
// Sugerencias de clasificación
// =============================================================================

export type Sugerencia = {
  resultado: ClasifResultado;
  reglaId: string | null;
  reglaDescripcion: string | null;
  reglaPrioridad: number | null;
  evaluadoAt: string;
};

export function sugerirParaColateral(colateralId: string, fecha?: string) {
  const qs = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  return api<Sugerencia>(`/colaterales/${colateralId}/sugerencia${qs}`);
}

export function sugerirParaAfiliado(afiliadoId: string, fecha?: string) {
  const qs = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  return api<(Sugerencia & { colateralId: string })[]>(
    `/colaterales/afiliados/${afiliadoId}/sugerencias${qs}`,
  );
}
