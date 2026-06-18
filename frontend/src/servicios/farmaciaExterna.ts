import { API_URL } from "./api";

/**
 * Cliente API para la vista pública de farmacia externa.
 *
 * Auth: token JWT propio (NO el de usuario admin). Se guarda en
 * `localStorage.farmaciaToken` para no chocar con `accessToken` del usuario.
 *
 * Endpoints públicos (todos bajo /farmacia-externa).
 */

const TOKEN_KEY = "farmaciaToken";
const FARMACIA_KEY = "farmaciaSession";

export type FarmaciaSesion = {
  id: string;
  codigo: string;
  nombre: string;
  organizacionId: string;
};

export function getFarmaciaToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getFarmaciaSesion(): FarmaciaSesion | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(FARMACIA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FarmaciaSesion;
  } catch {
    return null;
  }
}

export function clearFarmaciaSesion(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(FARMACIA_KEY);
}

async function feFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (init.auth !== false) {
    const tok = getFarmaciaToken();
    if (tok) headers["Authorization"] = `Bearer ${tok}`;
  }
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.message || body?.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

// =============================================================================
// Auth
// =============================================================================

export async function loginFarmacia(usuario: string, password: string) {
  const res = await feFetch<{
    accessToken: string;
    expiresIn: number;
    farmacia: FarmaciaSesion;
  }>("/farmacia-externa/auth/login", {
    method: "POST",
    body: JSON.stringify({ usuario, password }),
    auth: false,
  });
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    localStorage.setItem(FARMACIA_KEY, JSON.stringify(res.farmacia));
  }
  return res;
}

export function getMe() {
  return feFetch<FarmaciaSesion>("/farmacia-externa/auth/me");
}

// =============================================================================
// Operativa
// =============================================================================

export type AfiliadoBuscado = {
  titular: {
    id: string;
    dni: string;
    apellido: string;
    nombre: string;
    estado: string;
    coseguroActivo: boolean;
  };
  grupo: Array<{
    id: string;
    nombre: string;
    dni: string | null;
    fechaNacimiento: string | null;
    parentesco: { codigo: number; descripcion: string } | null;
  }>;
  saldoOrdenes: {
    periodo: string;
    cupo: number;
    consumidas: number;
    disponibles: number;
  };
};

export function buscarAfiliadoPorDni(dni: string) {
  return feFetch<AfiliadoBuscado>(
    `/farmacia-externa/afiliado?dni=${encodeURIComponent(dni.trim())}`,
  );
}

export function consumirOrden(body: {
  dni: string;
  integranteId?: string | null;
  observacion?: string | null;
  monto?: number | null;
}) {
  return feFetch<{
    id: string;
    numeroOrdenEnMes: number;
    periodo: string;
    consumidaEn: string;
    cupo: number;
    consumidas: number;
    disponibles: number;
  }>("/farmacia-externa/consumir", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export type ConsumoPropio = {
  id: string;
  consumidaEn: string;
  monto: number | null;
  observacion: string | null;
  anuladaEn: string | null;
  afiliado: {
    id: string;
    dni: string;
    apellido: string;
    nombre: string;
  };
  integrante: { id: string; nombre: string } | null;
};

export function listarMisConsumos(periodo?: string) {
  const qs = periodo ? `?periodo=${encodeURIComponent(periodo)}` : "";
  return feFetch<ConsumoPropio[]>(`/farmacia-externa/mis-consumos${qs}`);
}

export function anularConsumoPropio(consumoId: string, motivo: string) {
  return feFetch<{ ok: true }>(
    `/farmacia-externa/mis-consumos/${consumoId}/anular`,
    { method: "POST", body: JSON.stringify({ motivo }) },
  );
}
