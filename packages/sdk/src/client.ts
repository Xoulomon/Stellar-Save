/**
 * Typed REST API client for the Stellar-Save backend.
 * Works in both browser (fetch) and Node.js environments.
 */

import type {
  Group,
  GroupFilters,
  Contribution,
  Payout,
  CostReport,
  PaginatedResponse,
} from './types';

export interface ApiClientConfig {
  baseUrl: string;
  /** Admin secret for protected endpoints (server-side only). */
  adminSecret?: string;
  /** JWT bearer token for authenticated user endpoints. */
  authToken?: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class StellarSaveApiClient {
  private readonly config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    };

    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }
    if (this.config.adminSecret) {
      headers['x-admin-secret'] = this.config.adminSecret;
    }

    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      throw new ApiError(res.status, body);
    }

    return res.json() as Promise<T>;
  }

  // ── Groups ──────────────────────────────────────────────────────────────────

  listGroups(filters?: GroupFilters): Promise<PaginatedResponse<Group>> {
    const params = filters ? `?${new URLSearchParams(filters as Record<string, string>).toString()}` : '';
    return this.request(`/api/v1/groups${params}`);
  }

  getGroup(groupId: string): Promise<Group> {
    return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}`);
  }

  createGroup(data: Omit<Group, 'id' | 'createdAt' | 'currentMembers' | 'status'>): Promise<{ id: string }> {
    return this.request('/api/v1/groups', { method: 'POST', body: JSON.stringify(data) });
  }

  joinGroup(groupId: string): Promise<void> {
    return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}/join`, { method: 'POST' });
  }

  // ── Contributions ───────────────────────────────────────────────────────────

  getContributions(groupId: string, cycle?: number): Promise<Contribution[]> {
    const params = cycle !== undefined ? `?cycle=${cycle}` : '';
    return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}/contributions${params}`);
  }

  contribute(groupId: string, amount: number): Promise<{ txHash: string }> {
    return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}/contribute`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  // ── Payouts ─────────────────────────────────────────────────────────────────

  getPayouts(groupId: string): Promise<Payout[]> {
    return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}/payouts`);
  }

  executePayout(groupId: string): Promise<{ txHash: string }> {
    return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}/payout`, { method: 'POST' });
  }

  // ── Costs (admin) ───────────────────────────────────────────────────────────

  getCostReport(): Promise<CostReport> {
    return this.request('/api/v1/costs/report');
  }
}

/** Create a client pre-configured from environment variables (Node.js). */
export function createApiClient(overrides?: Partial<ApiClientConfig>): StellarSaveApiClient {
  return new StellarSaveApiClient({
    baseUrl: process.env['STELLAR_SAVE_API_URL'] ?? 'http://localhost:3001',
    adminSecret: process.env['ADMIN_SECRET'],
    authToken: process.env['AUTH_TOKEN'],
    ...overrides,
  });
}
