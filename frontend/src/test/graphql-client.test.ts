/**
 * Unit tests for src/graphql/client.ts
 *
 * Tests the `fetcher` factory function that wraps graphql-request and is
 * consumed by the generated React Query hooks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock setup ────────────────────────────────────────────────────────────────
// vi.hoisted() runs before vi.mock() hoisting, allowing the variable to be
// referenced safely inside the factory.
const mockRequest = vi.hoisted(() => vi.fn());

vi.mock('graphql-request', () => ({
  GraphQLClient: vi.fn().mockImplementation(() => ({
    request: mockRequest,
  })),
}));

// Import AFTER mocking
import { fetcher, graphqlClient } from '../graphql/client';
import { GraphQLClient } from 'graphql-request';

// ── Helpers ───────────────────────────────────────────────────────────────────

const QUERY = `query GetGroups { groups { id name } }`;

type GroupsData = { groups: Array<{ id: string; name: string }> };

const MOCK_DATA: GroupsData = {
  groups: [
    { id: '1', name: 'Alpha Group' },
    { id: '2', name: 'Beta Group' },
  ],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('graphqlClient singleton', () => {
  it('is exported and defined', () => {
    expect(graphqlClient).toBeDefined();
  });
});

describe('fetcher', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('returns a thunk (function)', () => {
    const thunk = fetcher<GroupsData, Record<string, never>>(QUERY);
    expect(typeof thunk).toBe('function');
  });

  it('thunk calls graphql-request with the query and no variables', async () => {
    mockRequest.mockResolvedValueOnce(MOCK_DATA);

    const thunk = fetcher<GroupsData, Record<string, never>>(QUERY);
    const result = await thunk();

    expect(mockRequest).toHaveBeenCalledOnce();
    expect(mockRequest).toHaveBeenCalledWith(QUERY, undefined);
    expect(result).toEqual(MOCK_DATA);
  });

  it('forwards variables to graphql-request', async () => {
    const variables = { id: 'group-1' };
    mockRequest.mockResolvedValueOnce({ group: { id: 'group-1', name: 'Test' } });

    const thunk = fetcher<{ group: { id: string; name: string } }, typeof variables>(
      QUERY,
      variables
    );
    await thunk();

    expect(mockRequest).toHaveBeenCalledWith(QUERY, variables);
  });

  it('resolves with the data returned by graphql-request', async () => {
    mockRequest.mockResolvedValueOnce(MOCK_DATA);

    const result = await fetcher<GroupsData, Record<string, never>>(QUERY)();

    expect(result).toStrictEqual(MOCK_DATA);
  });

  it('propagates errors thrown by graphql-request', async () => {
    const error = new Error('GraphQL network error');
    mockRequest.mockRejectedValueOnce(error);

    await expect(fetcher<GroupsData, Record<string, never>>(QUERY)()).rejects.toThrow(
      'GraphQL network error'
    );
  });

  it('creates a new GraphQLClient when extra headers are provided', async () => {
    mockRequest.mockResolvedValueOnce(MOCK_DATA);

    const MockedClient = vi.mocked(GraphQLClient);
    const callsBefore = MockedClient.mock.calls.length;

    const thunk = fetcher<GroupsData, Record<string, never>>(QUERY, undefined, {
      Authorization: 'Bearer token-abc',
    });
    await thunk();

    // A new client instance should have been constructed for per-request headers
    expect(MockedClient.mock.calls.length).toBeGreaterThan(callsBefore);

    const lastCallArgs = MockedClient.mock.calls[MockedClient.mock.calls.length - 1];
    const clientConfig = lastCallArgs[1] as { headers: Record<string, string> };
    expect(clientConfig.headers['Authorization']).toBe('Bearer token-abc');
    expect(clientConfig.headers['Content-Type']).toBe('application/json');
  });

  it('reuses the singleton client when no extra headers are provided', async () => {
    mockRequest.mockResolvedValueOnce(MOCK_DATA);

    const MockedClient = vi.mocked(GraphQLClient);
    const callsBefore = MockedClient.mock.calls.length;

    await fetcher<GroupsData, Record<string, never>>(QUERY)();

    // No additional GraphQLClient constructor call should have occurred
    expect(MockedClient.mock.calls.length).toBe(callsBefore);
  });

  it('calling the thunk multiple times re-executes the request each time', async () => {
    mockRequest.mockResolvedValue(MOCK_DATA);

    const thunk = fetcher<GroupsData, Record<string, never>>(QUERY);
    await thunk();
    await thunk();

    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
});
