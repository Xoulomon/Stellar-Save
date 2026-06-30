/**
 * api.ts
 *
 * Backend REST API client for Stellar Save.
 * Handles authentication, base URL, and common error handling.
 */

const API_BASE = '/api';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('stellar_save_jwt');
}

function setToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('stellar_save_jwt', token);
  else localStorage.removeItem('stellar_save_jwt');
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = opts;
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (res.status === 401) {
    setToken(null);
    throw new Error('Session expired. Please reconnect your wallet.');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let detail: unknown = text;
    try { detail = JSON.parse(text); } catch { /* keep raw text */ }
    throw new Error(
      typeof detail === 'object' && detail !== null && 'error' in detail
        ? String((detail as Record<string, unknown>).error)
        : `Request failed (${res.status})`
    );
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export { getToken, setToken };
export type { RequestOptions };
