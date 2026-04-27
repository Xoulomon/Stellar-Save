import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGroups, clearGroupsCache } from '../hooks/useGroups';
import * as groupApi from '../utils/groupApi';
import type { PublicGroup } from '../types/group';

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

beforeEach(() => {
  clearGroupsCache();
  vi.spyOn(groupApi, 'fetchGroups').mockResolvedValue(mockGroups);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useGroups', () => {
  it('loads groups on mount', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.groups).toHaveLength(3);
  });

  it('filters by search query', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ search: 'Alpha' }));
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.groups[0].name).toBe('Alpha Group');
  });

  it('filters by status', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ status: 'active' }));
    expect(result.current.groups.every((g) => g.status === 'active')).toBe(true);
  });

  it('filters by minAmount', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ minAmount: '100' }));
    expect(result.current.groups.every((g) => g.contributionAmount >= 100)).toBe(true);
  });

  it('filters by maxAmount', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ maxAmount: '100' }));
    expect(result.current.groups.every((g) => g.contributionAmount <= 100)).toBe(true);
  });

  it('filters by minMembers', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ minMembers: '5' }));
    expect(result.current.groups.every((g) => g.memberCount >= 5)).toBe(true);
  });

  it('filters by maxMembers', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ maxMembers: '5' }));
    expect(result.current.groups.every((g) => g.memberCount <= 5)).toBe(true);
  });

  it('sorts by name-asc', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ sort: 'name-asc' }));
    const names = result.current.groups.map((g) => g.name);
    expect(names).toEqual([...names].sort());
  });

  it('sorts by name-desc', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ sort: 'name-desc' }));
    const names = result.current.groups.map((g) => g.name);
    expect(names).toEqual([...names].sort().reverse());
  });

  it('sorts by amount-asc', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ sort: 'amount-asc' }));
    const amounts = result.current.groups.map((g) => g.contributionAmount);
    expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
  });

  it('sorts by members-desc', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ sort: 'members-desc' }));
    const counts = result.current.groups.map((g) => g.memberCount);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
  });

  it('sorts by date-asc', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ sort: 'date-asc' }));
    const dates = result.current.groups.map((g) => g.createdAt.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });

  it('clears filters', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ search: 'Alpha', status: 'active' }));
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => result.current.clearFilters());
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('paginates correctly', async () => {
    const { result } = renderHook(() => useGroups({ initialPageSize: 2 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.groups).toHaveLength(2);
    expect(result.current.pagination.totalPages).toBe(2);

    act(() => result.current.setPage(2));
    expect(result.current.groups).toHaveLength(1);
  });

  it('changes page size', async () => {
    const { result } = renderHook(() => useGroups({ initialPageSize: 2 }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setPageSize(10));
    expect(result.current.groups).toHaveLength(3);
  });

  it('handles fetch error', async () => {
    vi.spyOn(groupApi, 'fetchGroups').mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Network error');
  });

  it('refresh busts cache and re-fetches', async () => {
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroups').mockResolvedValue(mockGroups);
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('filters by minCycleDuration', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ minCycleDuration: '14' }));
    expect(
      result.current.groups.every((g) => g.cycleDuration !== undefined && g.cycleDuration >= 14)
    ).toBe(true);
  });

  it('filters by maxCycleDuration', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ maxCycleDuration: '14' }));
    expect(
      result.current.groups.every((g) => g.cycleDuration !== undefined && g.cycleDuration <= 14)
    ).toBe(true);
  });

  it('hasActiveFilters is true when cycleDuration filter is set', async () => {
    const { result } = renderHook(() => useGroups());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setFilters({ minCycleDuration: '7' }));
    expect(result.current.hasActiveFilters).toBe(true);
  });
});
