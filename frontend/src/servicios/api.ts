// src/servicios/api.ts

/** Base URL del API. En dev el navegador usa /api (proxy Next -> Nest) para evitar CORS. */
function resolveApiUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  const devProxy =
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_USE_API_PROXY !== "false";

  if (typeof window !== "undefined" && devProxy) {
    return explicit?.startsWith("/") ? explicit : "/api";
  }
  if (explicit) return explicit;
  if (devProxy) {
    return (process.env.BACKEND_URL || "http://localhost:3001").replace(/\/+$/, "");
  }
  return "http://localhost:3001";
}

export const API_URL = resolveApiUrl();
/** Organizacion por defecto (opcional). Si no esta definida, el login usa el selector o la unica org del sistema. */
export const ORG = process.env.NEXT_PUBLIC_TENANT_ID || "";

let refreshPromise: Promise<boolean> | null = null;

function join(base: string, p: string) {
  if (!p) throw new Error("api(path): path vacio");
  if (p.startsWith("/undefined")) {
    throw new Error(`api(path): path invalido (${p}). Tenes una variable no seteada.`);
  }
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${base}${path}`;
}

function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

async function refreshAuthToken(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) return false;

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      return true;
    } catch (error) {
      console.error("Error renovando token:", error);
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function doLogout() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("organizacionId");
  window.location.href = "/login";
}

export function getOrgId(): string {
  if (typeof window === "undefined") return ORG;
  return localStorage.getItem("organizacionId") || ORG;
}

export function setOrganizacionId(orgId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("organizacionId", orgId);
}

function buildAuthHeaders(
  initHeaders: HeadersInit | undefined,
  includeJsonContentType = true,
): Record<string, string> {
  const token = getAuthToken();
  const headers = new Headers(initHeaders);

  if (!headers.has("X-Organizacion-ID")) {
    const orgId = getOrgId();
    if (orgId) {
      headers.set("X-Organizacion-ID", orgId);
    }
  }

  if (includeJsonContentType && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return Object.fromEntries(headers.entries());
}

async function authenticatedFetch(
  path: string,
  init: RequestInit = {},
  options?: { includeJsonContentType?: boolean },
): Promise<Response> {
  if (!API_URL) throw new Error("Falta NEXT_PUBLIC_API_URL");

  const url = join(API_URL, path);
  const hadToken = Boolean(getAuthToken());
  const includeJsonContentType = options?.includeJsonContentType ?? true;

  let res = await fetch(url, {
    ...init,
    headers: buildAuthHeaders(init.headers, includeJsonContentType),
    cache: "no-store",
  });

  if (res.status === 401 && hadToken) {
    const refreshSuccess = await refreshAuthToken();

    if (refreshSuccess) {
      res = await fetch(url, {
        ...init,
        headers: buildAuthHeaders(init.headers, includeJsonContentType),
        cache: "no-store",
      });
    } else {
      doLogout();
      throw new Error("Sesion expirada. Redirigiendo al login...");
    }
  }

  return res;
}

async function ensureOk(res: Response, path: string): Promise<Response> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");

    if (res.status === 401) {
      doLogout();
      throw new Error("No autorizado. Redirigiendo al login...");
    }

    // Intentamos extraer el `message` del body JSON de NestJS para mostrar
    // un error legible. Si no es JSON, caemos al texto crudo recortado.
    let friendly: string | null = null;
    try {
      const body: unknown = JSON.parse(text);
      friendly = parseApiErrorMessage(body, "");
    } catch {
      /* no era JSON */
    }

    if (friendly) {
      throw new Error(friendly);
    }
    throw new Error(`HTTP ${res.status} @ ${join(API_URL, path)}\n${text.slice(0, 300)}`);
  }

  return res;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await authenticatedFetch(path, init);
  await ensureOk(res, path);
  return (await res.json()) as T;
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  options?: { includeJsonContentType?: boolean },
): Promise<Response> {
  const res = await authenticatedFetch(path, init, options);
  return ensureOk(res, path);
}

export async function apiBlob(
  path: string,
  init: RequestInit = {},
  options?: { includeJsonContentType?: boolean },
): Promise<Blob> {
  const res = await apiFetch(path, init, options);
  return await res.blob();
}

export async function apiText(
  path: string,
  init: RequestInit = {},
  options?: { includeJsonContentType?: boolean },
): Promise<string> {
  const res = await apiFetch(path, init, options);
  return await res.text();
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export type OrgLite = { id: string; nombre: string };

export async function authOrganizaciones(): Promise<OrgLite[]> {
  try {
    const res = await fetch(`${API_URL}/auth/organizaciones`);
    if (!res.ok) return [];
    return (await res.json()) as OrgLite[];
  } catch {
    return [];
  }
}

function parseApiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const msg = (body as { message?: string | string[] }).message;
  if (Array.isArray(msg)) return msg.join(". ");
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

export async function authLogin(credentials: {
  email: string;
  password: string;
  organizacionId?: string;
}): Promise<void> {
  const orgId = (credentials.organizacionId || ORG || "").trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (orgId) {
    headers["X-Organizacion-ID"] = orgId;
  }

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: credentials.email.trim(),
      password: credentials.password,
      ...(orgId ? { organizacionId: orgId } : {}),
    }),
  });

  if (!res.ok) {
    let message = "Credenciales invalidas. Verifica email, contrasena y organizacion.";
    try {
      message = parseApiErrorMessage(await res.json(), message);
    } catch {
      /* cuerpo no JSON */
    }
    throw new Error(message);
  }

  const data = await res.json();
  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);
  if (data.usuario?.organizacionId) {
    localStorage.setItem("organizacionId", data.usuario.organizacionId);
  }
}

export async function authLogout(): Promise<void> {
  try {
    const token = getAuthToken();
    const refreshToken =
      typeof window !== "undefined" ? localStorage.getItem("refreshToken") : null;
    if (token && refreshToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken }),
      });
    }
  } finally {
    doLogout();
  }
}

export async function authMe(): Promise<{
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  roles: string[];
  organizacionId: string;
}> {
  return api("/auth/profile");
}

export async function getPdfBlob(path: string): Promise<Blob> {
  return apiBlob(path, { method: "GET" }, { includeJsonContentType: false });
}

export async function openPdf(path: string): Promise<void> {
  try {
    const blob = await getPdfBlob(path);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "width=800,height=600");
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (error) {
    console.error("Error abriendo PDF:", error);
    throw error;
  }
}

export async function downloadPdf(path: string, filename: string): Promise<void> {
  try {
    const blob = await getPdfBlob(path);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error("Error descargando PDF:", error);
    throw error;
  }
}
