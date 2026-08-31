import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useGroups } from '../hooks/useGroups';
import * as db from '../lib/db';
import * as groupApi from '../utils/groupApi';

import type { PublicGroup } from '../types/group';
import type { ReactNode } from 'react';

// useGroups() caches successful fetches to IndexedDB (via lib/db) for
// offline fallback. jsdom doesn't implement IndexedDB, so stub the cache
// layer here rather than exercising real IndexedDB in these hook tests.
vi.mock('../lib/db', () => ({
  cacheGroupsList: vi.fn(),
  getCachedGroupsListWithStatus: vi.fn(),
}));

const mockGroups: PublicGroup[] = [
  {
    id: '1',
    name: 'Alpha Group',
    description: 'First group',
    memberCount: 5,
    contributionAmount: 100,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    cycleDuration: 7,
  },
  {
    id: '2',
    name: 'Beta Group',
    description: 'Second group',
    memberCount: 10,
    contributionAmount: 200,
    currency: 'XLM',
    status: 'pending',
    createdAt: new Date('2024-02-01'),
    cycleDuration: 14,
  },
  {
    id: '3',
    name: 'Gamma Group',
    memberCount: 3,
    contributionAmount: 50,
    currency: 'XLM',
    status: 'completed',
    createdAt: new Date('2024-03-01'),
    cycleDuration: 30,
  },
];

// Each test gets its own QueryClient so cached list data from one test
// (keyed by filters) never leaks into the next.
function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.spyOn(groupApi, 'fetchGroups').mockResolvedValue(mockGroups);
  vi.mocked(db.cacheGroupsList).mockResolvedValue(undefined);
  vi.mocked(db.getCachedGroupsListWithStatus).mockResolvedValue({
    groups: [],
    fromCache: false,
    isStale: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useGroups', () => {
  it('loads groups on mount', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.groups).toHaveLength(3);
  });

  it('filters by search query', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ search: 'Alpha' }));
    await waitFor(() => expect(result.current.groups).toHaveLength(1));
    expect(result.current.groups[0].name).toBe('Alpha Group');
  });

  it('filters by status', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ status: 'active' }));
    await waitFor(() => {
      expect(result.current.groups.length).toBeGreaterThan(0);
      expect(result.current.groups.every((g) => g.status === 'active')).toBe(true);
    });
  });

  it('filters by minAmount', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ minAmount: '100' }));
    await waitFor(() => {
      expect(result.current.groups.length).toBeGreaterThan(0);
      expect(result.current.groups.every((g) => g.contributionAmount >= 100)).toBe(true);
    });
  });

  it('filters by maxAmount', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ maxAmount: '100' }));
    await waitFor(() => {
      expect(result.current.groups.length).toBeGreaterThan(0);
      expect(result.current.groups.every((g) => g.contributionAmount <= 100)).toBe(true);
    });
  });

  it('filters by minMembers', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ minMembers: '5' }));
    await waitFor(() => {
      expect(result.current.groups.length).toBeGreaterThan(0);
      expect(result.current.groups.every((g) => g.memberCount >= 5)).toBe(true);
    });
  });

  it('filters by maxMembers', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ maxMembers: '5' }));
    await waitFor(() => {
      expect(result.current.groups.length).toBeGreaterThan(0);
      expect(result.current.groups.every((g) => g.memberCount <= 5)).toBe(true);
    });
  });

  it('sorts by name-asc', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ sort: 'name-asc' }));
    await waitFor(() => expect(result.current.groups).toHaveLength(3));
    const names = result.current.groups.map((g) => g.name);
    expect(names).toEqual([...names].sort());
  });

  it('sorts by name-desc', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ sort: 'name-desc' }));
    await waitFor(() => expect(result.current.groups).toHaveLength(3));
    const names = result.current.groups.map((g) => g.name);
    expect(names).toEqual([...names].sort().reverse());
  });

  it('sorts by amount-asc', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ sort: 'amount-asc' }));
    await waitFor(() => expect(result.current.groups).toHaveLength(3));
    const amounts = result.current.groups.map((g) => g.contributionAmount);
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  it('sorts by members-desc', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ sort: 'members-desc' }));
    await waitFor(() => expect(result.current.groups).toHaveLength(3));
    const counts = result.current.groups.map((g) => g.memberCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('sorts by date-asc', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ sort: 'date-asc' }));
    await waitFor(() => expect(result.current.groups).toHaveLength(3));
    const dates = result.current.groups.map((g) => g.createdAt.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it('clears filters', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ search: 'Alpha', status: 'active' }));
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => result.current.clearFilters());
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('paginates correctly', async () => {
    const { result } = renderHook(() => useGroups({ initialPageSize: 2 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.groups).toHaveLength(2);
    expect(result.current.pagination.totalPages).toBe(2);

    act(() => result.current.setPage(2));
    expect(result.current.groups).toHaveLength(1);
  });

  it('changes page size', async () => {
    const { result } = renderHook(() => useGroups({ initialPageSize: 2 }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setPageSize(10));
    expect(result.current.groups).toHaveLength(3);
  });

  it('handles fetch error by falling back to offline cache, surfacing an error when no cache exists', async () => {
    // useGroups() swallows the network error and tries the offline cache
    // before giving up (see hooks/useGroups.ts) -- with no cache available
    // (the default lib/db mock above), it surfaces its own fallback message
    // rather than the original network error.
    vi.spyOn(groupApi, 'fetchGroups').mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('No data available offline');
  });

  it('refresh busts cache and re-fetches', async () => {
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroups').mockResolvedValue(mockGroups);
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.refresh());
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });

  it('filters by minCycleDuration', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ minCycleDuration: '14' }));
    await waitFor(() => {
      expect(result.current.groups.length).toBeGreaterThan(0);
      expect(
        result.current.groups.every((g) => g.cycleDuration !== undefined && g.cycleDuration >= 14)
      ).toBe(true);
    });
  });

  it('filters by maxCycleDuration', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ maxCycleDuration: '14' }));
    await waitFor(() => {
      expect(result.current.groups.length).toBeGreaterThan(0);
      expect(
        result.current.groups.every((g) => g.cycleDuration !== undefined && g.cycleDuration <= 14)
      ).toBe(true);
    });
  });

  it('hasActiveFilters is true when cycleDuration filter is set', async () => {
    const { result } = renderHook(() => useGroups(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ minCycleDuration: '7' }));
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it('shares the same query key as GroupsPage/GroupComparisonPage for identical filters', async () => {
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroups').mockResolvedValue(mockGroups);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const sharedWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Two independent consumers with the same default filters, mounted
    // against the same QueryClient (as they would be in the real app),
    // should reuse one cache entry instead of both fetching.
    const { result: first } = renderHook(() => useGroups(), { wrapper: sharedWrapper });
    await waitFor(() => expect(first.current.isLoading).toBe(false));

    const { result: second } = renderHook(() => useGroups(), { wrapper: sharedWrapper });
    await waitFor(() => expect(second.current.isLoading).toBe(false));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second.current.groups).toHaveLength(3);
  });
});
