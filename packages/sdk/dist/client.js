/**
 * Typed REST API client for the Stellar-Save backend.
 * Works in both browser (fetch) and Node.js environments.
 */
export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}
export class StellarSaveApiClient {
    config;
    constructor(config) {
        this.config = config;
    }
    async request(path, init) {
        const headers = {
            'Content-Type': 'application/json',
            ...init?.headers,
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
        return res.json();
    }
    // ── Groups ──────────────────────────────────────────────────────────────────
    listGroups(filters) {
        const params = filters ? `?${new URLSearchParams(filters).toString()}` : '';
        return this.request(`/api/v1/groups${params}`);
    }
    getGroup(groupId) {
        return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}`);
    }
    createGroup(data) {
        return this.request('/api/v1/groups', { method: 'POST', body: JSON.stringify(data) });
    }
    joinGroup(groupId) {
        return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}/join`, { method: 'POST' });
    }
    // ── Contributions ───────────────────────────────────────────────────────────
    getContributions(groupId, cycle) {
        const params = cycle !== undefined ? `?cycle=${cycle}` : '';
        return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}/contributions${params}`);
    }
    contribute(groupId, amount) {
        return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}/contribute`, {
            method: 'POST',
            body: JSON.stringify({ amount }),
        });
    }
    // ── Payouts ─────────────────────────────────────────────────────────────────
    getPayouts(groupId) {
        return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}/payouts`);
    }
    executePayout(groupId) {
        return this.request(`/api/v1/groups/${encodeURIComponent(groupId)}/payout`, { method: 'POST' });
    }
    // ── Costs (admin) ───────────────────────────────────────────────────────────
    getCostReport() {
        return this.request('/api/v1/costs/report');
    }
}
/** Create a client pre-configured from environment variables (Node.js). */
export function createApiClient(overrides) {
    return new StellarSaveApiClient({
        baseUrl: process.env['STELLAR_SAVE_API_URL'] ?? 'http://localhost:3001',
        adminSecret: process.env['ADMIN_SECRET'],
        authToken: process.env['AUTH_TOKEN'],
        ...overrides,
    });
}
