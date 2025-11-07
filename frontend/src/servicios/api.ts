// src/servicios/api.ts
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
export const ORG = process.env.NEXT_PUBLIC_TENANT_ID!;

function join(base: string, p: string) {
  if (!p) throw new Error("api(path): path vacío");
  if (p.startsWith("/undefined")) {
    throw new Error(`api(path): path inválido (${p}). Tenés una variable no seteada.`);
  }
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${base}${path}`;
}

/** Fetch tipado */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error("Falta NEXT_PUBLIC_API_URL");
  // NO incluyas '/api' en `path`. Ponelo una sola vez en NEXT_PUBLIC_API_URL
  const url = join(API_URL, path);

  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Organizacion-ID": ORG,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Log detallado para detectar enseguida si pegaste al frontend (HTML) o a la API
    throw new Error(`HTTP ${res.status} @ ${url}\n${text.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}