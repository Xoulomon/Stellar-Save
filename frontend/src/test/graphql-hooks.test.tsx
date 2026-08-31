/**
 * Unit tests for generated hooks in src/generated/graphql.ts
 *
 * Covers:
 *   - useGetGroupsQuery
 *   - useGetGroupQuery
 *   - useGetMembersQuery
 *   - useSetPreferencesMutation
 *   - useGetTransactionsQuery
 *
 * Strategy: mock `graphql/client#fetcher` so hooks never hit the network.
 * Each test mounts the hook inside a fresh QueryClientProvider wrapper.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Mock the fetcher ──────────────────────────────────────────────────────────
// The generated hooks call:  fetcher<T, V>(document, variables)()
// We replace `fetcher` with a factory that returns a mock thunk.
const mockFetcherThunk = vi.hoisted(() => vi.fn());

vi.mock('../graphql/client', () => ({
  graphqlClient: {},
  fetcher: vi.fn(() => mockFetcherThunk),
}));

import {
  useGetGroupsQuery,
  useGetGroupQuery,
  useGetMembersQuery,
  useSetPreferencesMutation,
  useGetTransactionsQuery,
} from '../generated/graphql';
import type {
  GetGroupsQuery,
  GetGroupQuery,
  GetMembersQuery,
  GetTransactionsQuery,
  SetPreferencesMutation,
  SetPreferencesMutationVariables,
} from '../generated/graphql';
import { fetcher } from '../graphql/client';

// ── Wrapper factory ───────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const groupFragment = {
  __typename: 'Group' as const,
  id: 'g1',
  name: 'Alpha Savings',
  contributionAmount: 200,
  cycleDuration: 30,
  maxMembers: 10,
  currentMembers: 4,
  status: 'active',
  tags: ['savings'],
};

const memberFragment = {
  __typename: 'Member' as const,
  id: 'm1',
  address: 'GAAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKKLLLLMMMMNNNN',
  name: 'Alice',
  joinedAt: 1_700_000_000,
  groupIds: ['g1'],
};

const txFragment = {
  __typename: 'Transaction' as const,
  id: 'tx1',
  groupId: 'g1',
  memberAddress: 'GAAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKKLLLLMMMMNNNN',
  amount: 200,
  type: 'contribution' as const,
  timestamp: 1_700_000_000,
  stellarTxHash: 'abc123',
};

const GET_GROUPS_RESPONSE: GetGroupsQuery = {
  groups: [groupFragment],
};

const GET_GROUP_RESPONSE: GetGroupQuery = {
  group: {
    ...groupFragment,
    members: [
      {
        __typename: 'Member',
        id: 'm1',
        address: 'GAAA...',
        name: 'Alice',
        joinedAt: 1_700_000_000,
      },
    ],
    transactions: [txFragment],
  },
};

const GET_MEMBERS_RESPONSE: GetMembersQuery = {
  members: [memberFragment],
};

const GET_TRANSACTIONS_RESPONSE: GetTransactionsQuery = {
  transactions: [txFragment],
};

const SET_PREFERENCES_RESPONSE: SetPreferencesMutation = {
  setPreferences: true,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useGetGroupsQuery', () => {
  beforeEach(() => {
    mockFetcherThunk.mockReset();
  });

  it('returns groups data on success', async () => {
    mockFetcherThunk.mockResolvedValueOnce(GET_GROUPS_RESPONSE);

    const { result } = renderHook(() => useGetGroupsQuery(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.groups).toHaveLength(1);
    expect(result.current.data?.groups[0].id).toBe('g1');
    expect(result.current.data?.groups[0].name).toBe('Alpha Savings');
  });

  it('sets isLoading true initially', () => {
    mockFetcherThunk.mockReturnValueOnce(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useGetGroupsQuery(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('sets isError true on failure', async () => {
    mockFetcherThunk.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useGetGroupsQuery(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it('exposes a static getKey method', () => {
    expect(typeof useGetGroupsQuery.getKey).toBe('function');
    expect(useGetGroupsQuery.getKey()).toEqual(['GetGroups']);
    expect(useGetGroupsQuery.getKey({})).toEqual(['GetGroups', {}]);
  });

  it('exposes a static fetcher method', () => {
    expect(typeof useGetGroupsQuery.fetcher).toBe('function');
  });

  it('calls the fetcher with the GetGroups document', async () => {
    mockFetcherThunk.mockResolvedValueOnce(GET_GROUPS_RESPONSE);
    const mockedFetcher = vi.mocked(fetcher);

    renderHook(() => useGetGroupsQuery(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockedFetcher).toHaveBeenCalled());

    const [document] = mockedFetcher.mock.calls[0];
    expect(document).toContain('GetGroups');
  });
});

describe('useGetGroupQuery', () => {
  beforeEach(() => {
    mockFetcherThunk.mockReset();
  });

  it('returns a single group with members and transactions', async () => {
    mockFetcherThunk.mockResolvedValueOnce(GET_GROUP_RESPONSE);

    const { result } = renderHook(() => useGetGroupQuery({ id: 'g1' }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.group?.id).toBe('g1');
    expect(result.current.data?.group?.members).toHaveLength(1);
    expect(result.current.data?.group?.transactions).toHaveLength(1);
  });

  it('returns null group when not found', async () => {
    mockFetcherThunk.mockResolvedValueOnce({ group: null });

    const { result } = renderHook(() => useGetGroupQuery({ id: 'missing' }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.group).toBeNull();
  });

  it('sets isError on failure', async () => {
    mockFetcherThunk.mockRejectedValueOnce(new Error('Not found'));

    const { result } = renderHook(() => useGetGroupQuery({ id: 'bad' }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('exposes a static getKey method with variables', () => {
    expect(useGetGroupQuery.getKey({ id: 'g1' })).toEqual(['GetGroup', { id: 'g1' }]);
  });
});

describe('useGetMembersQuery', () => {
  beforeEach(() => {
    mockFetcherThunk.mockReset();
  });

  it('returns members list on success', async () => {
    mockFetcherThunk.mockResolvedValueOnce(GET_MEMBERS_RESPONSE);

    const { result } = renderHook(() => useGetMembersQuery(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.members).toHaveLength(1);
    expect(result.current.data?.members[0].address).toBe(
      'GAAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKKLLLLMMMMNNNN'
    );
  });

  it('sets isLoading true initially', () => {
    mockFetcherThunk.mockReturnValueOnce(new Promise(() => {}));

    const { result } = renderHook(() => useGetMembersQuery(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('sets isError on network failure', async () => {
    mockFetcherThunk.mockRejectedValueOnce(new Error('Server error'));

    const { result } = renderHook(() => useGetMembersQuery(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('exposes a static getKey method', () => {
    expect(useGetMembersQuery.getKey()).toEqual(['GetMembers']);
  });
});

describe('useGetTransactionsQuery', () => {
  beforeEach(() => {
    mockFetcherThunk.mockReset();
  });

  it('returns all transactions when called without a groupId', async () => {
    mockFetcherThunk.mockResolvedValueOnce(GET_TRANSACTIONS_RESPONSE);

    const { result } = renderHook(() => useGetTransactionsQuery(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.transactions).toHaveLength(1);
    expect(result.current.data?.transactions[0].type).toBe('contribution');
  });

  it('passes groupId variable to the fetcher', async () => {
    mockFetcherThunk.mockResolvedValueOnce(GET_TRANSACTIONS_RESPONSE);
    const mockedFetcher = vi.mocked(fetcher);
    mockedFetcher.mockClear();

    renderHook(() => useGetTransactionsQuery({ groupId: 'g1' }), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(mockedFetcher).toHaveBeenCalled());
    const [, variables] = mockedFetcher.mock.calls[0];
    expect((variables as { groupId: string }).groupId).toBe('g1');
  });

  it('sets isError on failure', async () => {
    mockFetcherThunk.mockRejectedValueOnce(new Error('timeout'));

    const { result } = renderHook(() => useGetTransactionsQuery(), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('exposes a static getKey method', () => {
    expect(useGetTransactionsQuery.getKey()).toEqual(['GetTransactions']);
    expect(useGetTransactionsQuery.getKey({ groupId: 'g1' })).toEqual([
      'GetTransactions',
      { groupId: 'g1' },
    ]);
  });
});

describe('useSetPreferencesMutation', () => {
  beforeEach(() => {
    mockFetcherThunk.mockReset();
  });

  it('executes the mutation and returns setPreferences: true on success', async () => {
    mockFetcherThunk.mockResolvedValueOnce(SET_PREFERENCES_RESPONSE);

    const { result } = renderHook(() => useSetPreferencesMutation(), {
      wrapper: makeWrapper(),
    });

    const variables: SetPreferencesMutationVariables = {
      userId: 'u1',
      tags: ['savings', 'monthly'],
      minContribution: 50,
      maxContribution: 500,
    };

    result.current.mutate(variables);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.setPreferences).toBe(true);
  });

  it('is idle before any mutation call', () => {
    mockFetcherThunk.mockResolvedValue(SET_PREFERENCES_RESPONSE);

    const { result } = renderHook(() => useSetPreferencesMutation(), {
      wrapper: makeWrapper(),
    });

    expect(result.current.isIdle).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('sets isError on mutation failure', async () => {
    mockFetcherThunk.mockRejectedValueOnce(new Error('Unauthorized'));

    const { result } = renderHook(() => useSetPreferencesMutation(), {
      wrapper: makeWrapper(),
    });

    result.current.mutate({
      userId: 'u1',
      tags: [],
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('exposes a static fetcher method', () => {
    expect(typeof useSetPreferencesMutation.fetcher).toBe('function');
  });

  it('calls onSuccess callback when provided', async () => {
    mockFetcherThunk.mockResolvedValueOnce(SET_PREFERENCES_RESPONSE);
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useSetPreferencesMutation({ onSuccess }), {
      wrapper: makeWrapper(),
    });

    const vars: SetPreferencesMutationVariables = { userId: 'u1', tags: ['test'] };
    result.current.mutate(vars);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    // Verify the data and variables args — TanStack Query v5 also passes
    // context and a mutation object as additional trailing arguments.
    const [data, variables] = onSuccess.mock.calls[0];
    expect(data).toEqual(SET_PREFERENCES_RESPONSE);
    expect(variables).toEqual(vars);
  });
});
