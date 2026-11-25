import { env } from '../lib/env';

export interface ApiResponseEnvelope<T> {
  data: T | null;
  meta?: Record<string, unknown>;
  errors?: Array<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  authenticated?: boolean;
  errorLabel?: string;
  acceptedStatuses?: number[];
  tokenKey?: string;
}

export const API_BASE_URL = env.VITE_API_BASE_URL;

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    authenticated = false,
    errorLabel,
    acceptedStatuses = [],
    tokenKey = 'auth_token',
  } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (authenticated) {
    const token = localStorage.getItem(tokenKey);
    if (!token) throw new Error('Authentication required');
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (acceptedStatuses.includes(response.status)) return null as T;

  if (!response.ok) {
    throw new Error(
      errorLabel
        ? `Failed to ${errorLabel}: ${response.statusText}`
        : `Request failed: ${response.statusText}`
    );
  }

  const envelope = (await response.json()) as ApiResponseEnvelope<T>;
  if (envelope.errors?.length) throw new Error(envelope.errors[0].message);

  return envelope.data as T;
}
