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
function doLogout() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('organizacionId');

  // Redirigir al login
  window.location.href = '/login';
}

function getOrgId(): string {
  if (typeof window === 'undefined') return ORG;
  return localStorage.getItem('organizacionId') || ORG;
}

export function setOrganizacionId(orgId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('organizacionId', orgId);
}

/** Fetch tipado con autenticación automática */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error("Falta NEXT_PUBLIC_API_URL");
  
  const url = join(API_URL, path);
  const token = getAuthToken();

  // Preparar headers con autenticación
  const initHeaders = (init.headers || {}) as Record<string, string>;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Organizacion-ID": initHeaders["X-Organizacion-ID"] ?? getOrgId(),
    ...initHeaders,
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
      doLogout();
      throw new Error('Sesión expirada. Redirigiendo al login...');
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    
    // Si sigue siendo 401 después del intento de renovación, es un problema de autenticación
    if (res.status === 401) {
      doLogout();
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

export async function authLogin(credentials: {
  email: string;
  password: string;
  organizacionId: string;
}): Promise<boolean> {
  try {
    const orgId = credentials.organizacionId || ORG;
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Organizacion-ID': orgId,
      },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
        organizacionId: orgId,
      }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    if (data.usuario?.organizacionId) {
      localStorage.setItem('organizacionId', data.usuario.organizacionId);
    }
    return true;
  } catch {
    return false;
  }
}

export async function authLogout(): Promise<void> {
  try {
    const token = getAuthToken();
    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } finally {
    doLogout();
  }
}

export async function authMe(): Promise<{ id: string; email: string; nombre: string; apellido: string; roles: string[]; organizacionId: string }> {
  return api('/auth/profile');
}

/** Obtener PDF como blob con autenticación */
export async function getPdfBlob(path: string): Promise<Blob> {
  if (!API_URL) throw new Error("Falta NEXT_PUBLIC_API_URL");
  
  const url = join(API_URL, path);
  const token = getAuthToken();

  // Preparar headers con autenticación
  const headers: Record<string, string> = {
    "X-Organizacion-ID": getOrgId(),
  };

  // Agregar token de autenticación si está disponible
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res = await fetch(url, {
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
          headers,
          cache: "no-store",
        });
      }
    } else {
      // No se pudo renovar el token, hacer logout
      doLogout();
      throw new Error('Sesión expirada. Redirigiendo al login...');
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    
    // Si sigue siendo 401 después del intento de renovación, es un problema de autenticación
    if (res.status === 401) {
      doLogout();
      throw new Error('No autorizado. Redirigiendo al login...');
    }
    
    throw new Error(`HTTP ${res.status} @ ${url}\n${text.slice(0, 300)}`);
  }

  return await res.blob();
}

/** Abrir PDF en nueva ventana con autenticación */
export async function openPdf(path: string): Promise<void> {
  try {
    const blob = await getPdfBlob(path);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "width=800,height=600");
    // Limpiar el objeto URL después de un tiempo para liberar memoria
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch (error) {
    console.error('Error abriendo PDF:', error);
    throw error;
  }
}

/** Descargar PDF con autenticación */
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
    // Limpiar el objeto URL después de un tiempo para liberar memoria
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error('Error descargando PDF:', error);
    throw error;
  }
}