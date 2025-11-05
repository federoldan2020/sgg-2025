export const API_URL = process.env.NEXT_PUBLIC_API_URL!;
export const ORG = process.env.NEXT_PUBLIC_TENANT_ID!;

/** Fetch tipado: res.json() es unknown → casteamos a T explícitamente. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Organizacion-ID': ORG,
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  const data = (await res.json()) as T;
  return data;
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}