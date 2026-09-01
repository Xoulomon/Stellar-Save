/**
 * MSW handlers for the Stellar Save backend REST API.
 *
 * These intercept `fetch` calls against the `/api` base path, matching
 * the `request()` helper in `src/utils/api.ts`.
 *
 * Handlers are intentionally generic so that any test can override
 * specific endpoints with `server.use(...)` without touching the defaults.
 *
 * @see docs/msw-handlers.md for the handler-adding convention.
 */

import { http, HttpResponse } from 'msw';

// ── Fixtures ──────────────────────────────────────────────────────────────────

export const DEFAULT_GROUPS = [
  {
    id: '1',
    name: 'Family Savings Circle',
    description: 'A trusted circle for family members to save together monthly.',
    memberCount: 8,
    contributionAmount: 500,
    currency: 'XLM',
    status: 'active',
    createdAt: '2026-01-10T00:00:00.000Z',
    cycleDuration: 30,
  },
  {
    id: '2',
    name: 'Vacation Fund 2026',
    description: 'Saving up for a group holiday.',
    memberCount: 5,
    contributionAmount: 250,
    currency: 'XLM',
    status: 'active',
    createdAt: '2026-02-01T00:00:00.000Z',
    cycleDuration: 14,
  },
];

export const DEFAULT_GROUP = DEFAULT_GROUPS[0];

export const DEFAULT_MEMBERS = [
  { id: '1', address: 'GABC1234567890ABCDEF', name: 'Alice', joinedAt: '2026-01-10T00:00:00.000Z', totalContributions: 750, isActive: true },
  { id: '2', address: 'GDEF0987654321FEDCBA', name: 'Bob', joinedAt: '2026-01-12T00:00:00.000Z', totalContributions: 500, isActive: true },
];

export const DEFAULT_CONTRIBUTIONS = [
  { id: 'c1', groupId: '1', memberId: '1', memberName: 'Alice', amount: 500, timestamp: '2026-04-20T10:30:00.000Z', transactionHash: 'tx_abc123', status: 'completed' },
  { id: 'c2', groupId: '1', memberId: '2', memberName: 'Bob', amount: 500, timestamp: '2026-04-15T14:22:00.000Z', transactionHash: 'tx_def456', status: 'completed' },
];

export const DEFAULT_AUTH_RESPONSE = {
  token: 'mock-jwt-token-for-testing',
  address: 'GABC1234567890ABCDEF',
};

// ── Handler factories ─────────────────────────────────────────────────────────

/**
 * Returns an array of `http` handlers covering the default backend REST
 * endpoints used across the test suite.
 *
 * Registered in the server as fallback defaults; tests can override with
 * `server.use(http.get('/api/...', ...))` inside `beforeEach` / individual tests.
 */
export function createBackendHandlers() {
  return [
    // ── Authentication ─────────────────────────────────────────────────────────
    http.post('/api/auth/login', () => {
      return HttpResponse.json(DEFAULT_AUTH_RESPONSE);
    }),

    http.post('/api/auth/logout', () => {
      return HttpResponse.json({ success: true });
    }),

    // ── Groups ────────────────────────────────────────────────────────────────
    http.get('/api/groups', () => {
      return HttpResponse.json(DEFAULT_GROUPS);
    }),

    http.get('/api/groups/:groupId', ({ params }) => {
      const group = DEFAULT_GROUPS.find((g) => g.id === params['groupId']);
      if (!group) {
        return HttpResponse.json({ error: 'Group not found' }, { status: 404 });
      }
      return HttpResponse.json(group);
    }),

    http.post('/api/groups', async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 'new-group-id', ...body }, { status: 201 });
    }),

    // ── Members ───────────────────────────────────────────────────────────────
    http.get('/api/groups/:groupId/members', () => {
      return HttpResponse.json(DEFAULT_MEMBERS);
    }),

    http.post('/api/groups/:groupId/members', async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 'new-member-id', ...body }, { status: 201 });
    }),

    // ── Contributions ─────────────────────────────────────────────────────────
    http.get('/api/groups/:groupId/contributions', () => {
      return HttpResponse.json(DEFAULT_CONTRIBUTIONS);
    }),

    http.post('/api/groups/:groupId/contributions', async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ id: 'new-contribution-id', ...body, status: 'pending' }, { status: 201 });
    }),

    // ── Payouts ───────────────────────────────────────────────────────────────
    http.post('/api/groups/:groupId/payout', () => {
      return HttpResponse.json({ txHash: 'mock-tx-hash-for-payout', success: true });
    }),

    // ── User profile ──────────────────────────────────────────────────────────
    http.get('/api/users/:address', ({ params }) => {
      return HttpResponse.json({
        address: params['address'],
        name: 'Test User',
        joinedAt: '2026-01-01T00:00:00.000Z',
        groupIds: ['1'],
      });
    }),

    http.put('/api/users/:address', async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      return HttpResponse.json({ ...body });
    }),
  ];
}
