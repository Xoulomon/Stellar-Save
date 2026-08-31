import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useOfflineGroupsCache } from '../hooks/useOfflineGroupsCache';
import * as db from '../lib/db';
import { DEFAULT_GROUP_FILTERS } from '../types/group';
import * as groupApi from '../utils/groupApi';

import type { PublicGroup } from '../types/group';

// jsdom has no IndexedDB, so the cache layer is stubbed rather than exercised.
vi.mock('../lib/db', () => ({
  cacheGroupsList: vi.fn(),
  getCachedGroupsListWithStatus: vi.fn(),
}));

// Online/offline is the branch under test, so it is driven directly instead of
// through navigator.onLine and window events.
let mockIsOnline = true;
vi.mock('../hooks/offline', () => ({
  useIsOnline: () => mockIsOnline,
}));

const networkGroups: PublicGroup[] = [
  {
    id: '1',
    name: 'Alpha Group',
    description: 'From network',
    memberCount: 5,
    contributionAmount: 100,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2024-01-01'),
    cycleDuration: 7,
  },
];

const cachedGroups: PublicGroup[] = [
  {
    id: '2',
    name: 'Beta Group',
    description: 'From cache',
    memberCount: 3,
    contributionAmount: 50,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2024-02-01'),
    cycleDuration: 14,
  },
];

function setOnline(isOnline: boolean) {
  mockIsOnline = isOnline;
}

beforeEach(() => {
  vi.spyOn(groupApi, 'fetchGroups').mockResolvedValue(networkGroups);
  vi.mocked(db.cacheGroupsList).mockResolvedValue(undefined);
  vi.mocked(db.getCachedGroupsListWithStatus).mockResolvedValue({
    groups: cachedGroups,
    fromCache: true,
    isStale: false,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useOfflineGroupsCache', () => {
  it('starts with no cache flags set', () => {
    setOnline(true);
    const { result } = renderHook(() => useOfflineGroupsCache());
    expect(result.current.fromCache).toBe(false);
    expect(result.current.isStale).toBe(false);
  });

  it('fetches from the network and writes through to the cache when online', async () => {
    setOnline(true);
    const { result } = renderHook(() => useOfflineGroupsCache());

    let groups: PublicGroup[] = [];
    await act(async () => {
      groups = await result.current.fetchGroupsWithFallback(DEFAULT_GROUP_FILTERS);
    });

    expect(groups).toEqual(networkGroups);
    expect(groupApi.fetchGroups).toHaveBeenCalledWith(DEFAULT_GROUP_FILTERS);
    expect(db.cacheGroupsList).toHaveBeenCalledWith(networkGroups);
    await waitFor(() => expect(result.current.fromCache).toBe(false));
  });

  it('skips the network entirely when offline', async () => {
    setOnline(false);
    const { result } = renderHook(() => useOfflineGroupsCache());

    let groups: PublicGroup[] = [];
    await act(async () => {
      groups = await result.current.fetchGroupsWithFallback(DEFAULT_GROUP_FILTERS);
    });

    expect(groupApi.fetchGroups).not.toHaveBeenCalled();
    expect(groups).toEqual(cachedGroups);
    await waitFor(() => expect(result.current.fromCache).toBe(true));
  });

  it('falls back to the cache when the network fetch throws', async () => {
    setOnline(true);
    vi.spyOn(groupApi, 'fetchGroups').mockRejectedValue(new Error('offline'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useOfflineGroupsCache());

    let groups: PublicGroup[] = [];
    await act(async () => {
      groups = await result.current.fetchGroupsWithFallback(DEFAULT_GROUP_FILTERS);
    });

    expect(groups).toEqual(cachedGroups);
    expect(warn).toHaveBeenCalled();
    await waitFor(() => expect(result.current.fromCache).toBe(true));
  });

  it('surfaces the stale flag from the cache layer', async () => {
    setOnline(false);
    vi.mocked(db.getCachedGroupsListWithStatus).mockResolvedValue({
      groups: cachedGroups,
      fromCache: true,
      isStale: true,
    });
    const { result } = renderHook(() => useOfflineGroupsCache());

    await act(async () => {
      await result.current.fetchGroupsWithFallback(DEFAULT_GROUP_FILTERS);
    });

    await waitFor(() => expect(result.current.isStale).toBe(true));
  });

  it('throws when neither the network nor the cache can serve data', async () => {
    setOnline(false);
    vi.mocked(db.getCachedGroupsListWithStatus).mockResolvedValue({
      groups: [],
      fromCache: false,
      isStale: false,
    });
    const { result } = renderHook(() => useOfflineGroupsCache());

    await expect(
      result.current.fetchGroupsWithFallback(DEFAULT_GROUP_FILTERS),
    ).rejects.toThrow(/no data available offline/i);
  });

  it('clears the cache flags once a later online fetch succeeds', async () => {
    setOnline(false);
    const { result, rerender } = renderHook(() => useOfflineGroupsCache());

    await act(async () => {
      await result.current.fetchGroupsWithFallback(DEFAULT_GROUP_FILTERS);
    });
    await waitFor(() => expect(result.current.fromCache).toBe(true));

    setOnline(true);
    rerender();

    await act(async () => {
      await result.current.fetchGroupsWithFallback(DEFAULT_GROUP_FILTERS);
    });
    await waitFor(() => expect(result.current.fromCache).toBe(false));
  });
});
