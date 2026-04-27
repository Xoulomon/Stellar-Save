import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, vi } from 'vitest';
import { useDiscoveryFeed } from '../hooks/useDiscoveryFeed';
import * as groupApi from '../utils/groupApi';
import type { PublicGroup } from '../types/group';

const mockGroups: PublicGroup[] = [
  {
    id: '1',
    name: 'Alpha Group',
    description: 'Community savings',
    memberCount: 8,
    contributionAmount: 150,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-04-01'),
  },
  {
    id: '2',
    name: 'Budget Builders',
    description: 'Small monthly contributions',
    memberCount: 4,
    contributionAmount: 80,
    currency: 'XLM',
    status: 'pending',
    createdAt: new Date('2026-03-15'),
  },
  {
    id: '3',
    name: 'Travel Trust',
    description: 'Saving for the next adventure',
    memberCount: 12,
    contributionAmount: 300,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-02-10'),
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(groupApi, 'fetchGroups').mockResolvedValue(mockGroups);
});

describe('useDiscoveryFeed', () => {
  it('loads recommendations and exposes visible groups', async () => {
    const { result } = renderHook(() => useDiscoveryFeed({ initialPageSize: 2 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.recommendations).toHaveLength(2);
    expect(result.current.totalCount).toBe(3);
    expect(result.current.hasMore).toBe(true);
  });

  it('filters recommendations by search query', async () => {
    const { result } = renderHook(() => useDiscoveryFeed());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.setFilters({ search: 'Travel' });
    });

    expect(result.current.recommendations).toHaveLength(1);
    expect(result.current.recommendations[0].name).toBe('Travel Trust');
  });

  it('loads more recommendations when loadMore is called', async () => {
    const { result } = renderHook(() => useDiscoveryFeed({ initialPageSize: 1 }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.recommendations).toHaveLength(1);
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    expect(result.current.recommendations).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);
  });

  it('refresh re-fetches group data', async () => {
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroups');
    const { result } = renderHook(() => useDiscoveryFeed());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
