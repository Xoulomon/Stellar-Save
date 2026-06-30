import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useMembers, clearMembersCache } from '../hooks/useMembers';
import * as groupApi from '../utils/groupApi';
import type { GroupDetail } from '../types/group';

const mockGroup: GroupDetail = {
  id: 'g1',
  name: 'Test Group',
  description: 'A group',
  memberCount: 2,
  contributionAmount: 50,
  currency: 'XLM',
  status: 'active',
  createdAt: new Date('2024-01-01'),
  creator: 'GABCDEF',
  cycleDuration: 86400,
  maxMembers: 5,
  minMembers: 2,
  currentCycle: 1,
  isActive: true,
  started: true,
  startedAt: new Date('2024-01-15'),
  members: [
    {
      id: 'm1',
      address: 'GA1234567890123456789012345678901234567890',
      name: 'Alice',
      joinedAt: new Date('2024-01-15'),
      totalContributions: 100,
      isActive: true,
    },
    {
      id: 'm2',
      address: 'GB1234567890123456789012345678901234567890',
      name: 'Bob',
      joinedAt: new Date('2024-02-01'),
      totalContributions: 50,
      isActive: true,
    },
  ],
  contributions: [],
  cycles: [],
  currentCycle: {
    cycleNumber: 2,
    startDate: new Date('2024-02-15'),
    endDate: new Date('2024-03-15'),
    targetAmount: 600,
    currentAmount: 450,
    status: 'active',
  },
};

beforeEach(() => {
  clearMembersCache();
  vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMembers', () => {
  it('loads members when groupId is provided', async () => {
    const { result } = renderHook(() => useMembers('g1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.members).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('returns empty members and no error when groupId is null', () => {
    const { result } = renderHook(() => useMembers(null));
    expect(result.current.members).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets error when group is not found', async () => {
    vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(null);

    const { result } = renderHook(() => useMembers('missing'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.members).toEqual([]);
    expect(result.current.error).toBe('Group not found.');
  });

  it('sets error on fetch failure', async () => {
    vi.spyOn(groupApi, 'fetchGroup').mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useMembers('g1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.members).toEqual([]);
    expect(result.current.error).toBe('Server error');
  });

  it('refresh re-fetches data', async () => {
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup as any);
    const { result } = renderHook(() => useMembers('g1', { autoRefresh: false }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not auto-refresh when disabled', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup as any);
    renderHook(() => useMembers('g1', { autoRefresh: false }));

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
