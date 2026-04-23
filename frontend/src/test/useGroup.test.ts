import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGroup, clearGroupCache } from '../hooks/useGroup';
import * as groupApi from '../utils/groupApi';
import type { GroupDetail } from '../types/group';

const mockGroup: GroupDetail = {
  id: 'g1',
  name: 'Test Group',
  description: 'A group',
  memberCount: 5,
  contributionAmount: 100,
  currency: 'XLM',
  status: 'active',
  createdAt: new Date('2024-01-01'),
  creator: 'GABCDEF',
  cycleDuration: 604800,
  maxMembers: 10,
  minMembers: 2,
  currentCycle: 1,
  isActive: true,
  started: true,
  startedAt: new Date('2024-01-15'),
};

beforeEach(() => {
  clearGroupCache();
  vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useGroup', () => {
  it('fetches group on mount', async () => {
    const { result } = renderHook(() => useGroup('g1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.group).toEqual(mockGroup);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when groupId is null', () => {
    const { result } = renderHook(() => useGroup(null));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.group).toBeNull();
  });

  it('does not fetch when groupId is undefined', () => {
    const { result } = renderHook(() => useGroup(undefined));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.group).toBeNull();
  });

  it('sets error when group is not found', async () => {
    vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(null);
    const { result } = renderHook(() => useGroup('missing'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Group not found.');
    expect(result.current.group).toBeNull();
  });

  it('sets error on fetch failure', async () => {
    vi.spyOn(groupApi, 'fetchGroup').mockRejectedValue(new Error('Server error'));
    const { result } = renderHook(() => useGroup('g1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Server error');
  });

  it('refresh re-fetches the group', async () => {
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup);
    const { result } = renderHook(() => useGroup('g1', { autoRefresh: false }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not set up auto-refresh when autoRefresh is false', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup);
    renderHook(() => useGroup('g1', { autoRefresh: false }));
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
