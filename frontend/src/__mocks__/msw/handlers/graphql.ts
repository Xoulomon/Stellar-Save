/**
 * MSW handlers for the Stellar Save GraphQL API.
 *
 * These intercept requests to the GraphQL endpoint
 * (`http://localhost:4000/graphql` by default, or VITE_GRAPHQL_URL in env).
 *
 * Uses `msw`'s `graphql` namespace for operation-name-based matching, which
 * is more robust than URL matching for GraphQL.
 *
 * @see docs/msw-handlers.md for the handler-adding convention.
 */

import { graphql, HttpResponse } from 'msw';

// ── Fixtures ──────────────────────────────────────────────────────────────────

export const DEFAULT_GQL_GROUPS = [
  { id: '1', name: 'Family Savings Circle', status: 'active', memberCount: 8, contributionAmount: 500, currency: 'XLM' },
  { id: '2', name: 'Vacation Fund 2026', status: 'active', memberCount: 5, contributionAmount: 250, currency: 'XLM' },
];

export const DEFAULT_GQL_TRANSACTIONS = [
  { id: 'tx1', hash: 'abc123', type: 'payment', amount: '250.0000000', timestamp: '2026-04-20T10:30:00.000Z', status: 'completed' },
  { id: 'tx2', hash: 'def456', type: 'payment', amount: '1000.0000000', timestamp: '2026-04-15T14:22:00.000Z', status: 'completed' },
];

export const DEFAULT_GQL_MEMBERS = [
  { id: '1', address: 'GABC1234567890ABCDEF', name: 'Alice', isActive: true },
  { id: '2', address: 'GDEF0987654321FEDCBA', name: 'Bob', isActive: true },
];

// ── Handler factories ─────────────────────────────────────────────────────────

/**
 * Returns an array of GraphQL operation handlers covering the default queries
 * and mutations used across the test suite.
 *
 * Registered in the server as fallback defaults; tests can override with
 * `server.use(graphql.query('OperationName', ...))` inside `beforeEach` /
 * individual tests.
 */
export function createGraphQLHandlers() {
  return [
    // Queries
    graphql.query('GetGroups', () => {
      return HttpResponse.json({ data: { groups: DEFAULT_GQL_GROUPS } });
    }),

    graphql.query('GetGroup', ({ variables }) => {
      const group = DEFAULT_GQL_GROUPS.find((g) => g.id === (variables as { id?: string })?.id);
      if (!group) {
        return HttpResponse.json({ data: { group: null } });
      }
      return HttpResponse.json({ data: { group } });
    }),

    graphql.query('GetMembers', () => {
      return HttpResponse.json({ data: { members: DEFAULT_GQL_MEMBERS } });
    }),

    graphql.query('GetTransactions', () => {
      return HttpResponse.json({ data: { transactions: DEFAULT_GQL_TRANSACTIONS } });
    }),

    graphql.query('GetRecommendations', () => {
      return HttpResponse.json({ data: { recommendations: DEFAULT_GQL_GROUPS } });
    }),

    // Mutations
    graphql.mutation('SetPreferences', () => {
      return HttpResponse.json({ data: { setPreferences: { success: true } } });
    }),

    graphql.mutation('CreateGroup', ({ variables }) => {
      return HttpResponse.json({ data: { createGroup: { id: 'new-gql-group-id', ...(variables as object) } } });
    }),

    graphql.mutation('JoinGroup', () => {
      return HttpResponse.json({ data: { joinGroup: { success: true } } });
    }),
  ];
}
