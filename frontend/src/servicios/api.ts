// src/servicios/api.ts
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/+$/, "");
export const ORG = process.env.NEXT_PUBLIC_TENANT_ID || "3b883afc-f1ad-4d91-90c6-78654532ba9f";

function join(base: string, p: string) {
  if (!p) throw new Error("api(path): path vacío");
  if (p.startsWith("/undefined")) {
    throw new Error(`api(path): path inválido (${p}). Tenés una variable no seteada.`);
  }
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${base}${path}`;
}

// Función para obtener el token de autenticación
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null; // SSR
  return localStorage.getItem('accessToken');
}

// Función para renovar el token
async function refreshAuthToken(): Promise<boolean> {
  if (typeof window === 'undefined') return false; // SSR
  
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    
    return true;
  } catch (error) {
    console.error('Error renovando token:', error);
    return false;
  }
}

// Función para hacer logout
async function doLogout() {
  if (typeof window === 'undefined') return;
  
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
    }
  } finally {
    // Limpiar todas las credenciales y estados locales
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    try { sessionStorage.clear(); } catch {}
  }
  
  // Redirigir al login
  window.location.href = '/login';
}

/** Fetch tipado con autenticación automática */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error("Falta NEXT_PUBLIC_API_URL");
  
  const url = join(API_URL, path);
  const token = getAuthToken();

  // Preparar headers con autenticación
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Organizacion-ID": ORG,
    ...(init.headers as Record<string, string> || {}),
  };

  // Agregar token de autenticación si está disponible
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  // Si recibimos 401 (Unauthorized), intentar renovar el token
  if (res.status === 401 && token) {
    const refreshSuccess = await refreshAuthToken();
    
    if (refreshSuccess) {
      // Reintentar la request con el nuevo token
      const newToken = getAuthToken();
      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        
        res = await fetch(url, {
          ...init,
          headers,
          cache: "no-store",
        });
      }
    } else {
      // No se pudo renovar el token, hacer logout
      await doLogout();
      throw new Error('Sesión expirada. Redirigiendo al login...');
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    
    // Si sigue siendo 401 después del intento de renovación, es un problema de autenticación
    if (res.status === 401) {
      await doLogout();
      throw new Error('No autorizado. Redirigiendo al login...');
    }
    
    // Log detallado para otros errores
    throw new Error(`HTTP ${res.status} @ ${url}\n${text.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return String(err); }
}

// ======== Auth helpers ========
export async function authLogin(params: { email: string; password: string; organizacionId?: string }): Promise<boolean> {
  const organizacionId = params.organizacionId || ORG;
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: params.email, password: params.password, organizacionId }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
  }
  return true;
}

export async function authLogout(): Promise<void> {
  await doLogout();
}

export type Perfil = {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  roles: string[];
  organizacionId: string;
};

export async function authMe(): Promise<Perfil | null> {
  try {
    const perfil = await api<Perfil>('/auth/profile', { method: 'GET' });
    return perfil;
  } catch {
    return null;
  }
}

// Utilidad: construir referencia de cierre por caja
export function referenciaCierreCaja(cajaId: string | number): string {
  return `caja-${cajaId}`;
}