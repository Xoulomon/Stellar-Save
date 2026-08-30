import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';


import { useGroup, usePrefetchGroup } from '../hooks/useGroup';
import { queryKeys } from '../lib/queryKeys';
import * as groupApi from '../utils/groupApi';

import type { DetailedGroup } from '../utils/groupApi';
import type { ReactNode } from 'react';

const mockGroup: DetailedGroup = {
  id: 'g1',
  name: 'Test Group',
  description: 'A group',
  memberCount: 5,
  contributionAmount: 100,
  currency: 'XLM',
  status: 'active',
  createdAt: new Date('2024-01-01'),
  totalMembers: 5,
  targetAmount: 500,
  currentAmount: 250,
  contributionFrequency: 'monthly',
  members: [],
  contributions: [],
  cycles: [],
};

function createWrapper(client?: QueryClient) {
  const queryClient = client ?? new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useGroup', () => {
  it('fetches group on mount', async () => {
    vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGroup('g1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.group).toEqual(mockGroup);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when groupId is null', () => {
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroup');
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGroup(null), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.group).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not fetch when groupId is undefined', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGroup(undefined), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.group).toBeNull();
  });

  it('returns null group when the group is not found (queryFn resolves null)', async () => {
    vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(null);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGroup('missing'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.group).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    vi.spyOn(groupApi, 'fetchGroup').mockRejectedValue(new Error('Server error'));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGroup('g1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Server error');
  });

  it('refresh invalidates and re-fetches the group', async () => {
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useGroup('g1'), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    act(() => result.current.refresh());
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
  });

  it('shares its cache entry with usePrefetchGroup (queryKeys.groups.detail)', async () => {
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup);
    const { wrapper, queryClient } = createWrapper();

    // Simulate a hover-prefetch populating the cache before the detail
    // page ever mounts useGroup() for the same id.
    const { result: prefetchResult } = renderHook(() => usePrefetchGroup(), { wrapper });
    await act(async () => {
      await prefetchResult.current('g1');
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(queryClient.getQueryData(queryKeys.groups.detail('g1'))).toEqual(mockGroup);

    // useGroup() for the same id should reuse the prefetched cache entry
    // instead of firing a second network call.
    const { result } = renderHook(() => useGroup('g1'), { wrapper });
    await waitFor(() => expect(result.current.group).toEqual(mockGroup));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
