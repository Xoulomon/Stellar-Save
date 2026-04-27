import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useContributions, clearContributionsCache } from '../hooks/useContributions';
import * as groupApi from '../utils/groupApi';
import type { DetailedGroup } from '../utils/groupApi';

const mockGroup: DetailedGroup = {
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
  members: [],
  contributions: [
    {
      id: 'c1',
      memberId: '1',
      memberName: 'Alice',
      amount: 50,
      timestamp: new Date('2024-03-01'),
      transactionHash: 'tx1',
      status: 'completed',
    },
    {
      id: 'c2',
      memberId: '2',
      memberName: 'Bob',
      amount: 50,
      timestamp: new Date('2024-03-01'),
      transactionHash: 'tx2',
      status: 'pending',
    },
  ],
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
  clearContributionsCache();
  vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup as any);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useContributions', () => {
  it('loads contributions when groupId is provided', async () => {
    const { result } = renderHook(() => useContributions('g1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.contributions).toHaveLength(2);
    expect(result.current.status.totalContributions).toBe(2);
    expect(result.current.status.completedCount).toBe(1);
    expect(result.current.status.pendingCount).toBe(1);
    expect(result.current.status.failedCount).toBe(0);
    expect(result.current.status.totalAmount).toBe(100);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when groupId is null', () => {
    const { result } = renderHook(() => useContributions(null));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.contributions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('sets error when group is not found', async () => {
    vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(null);
    const { result } = renderHook(() => useContributions('missing'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Group not found.');
    expect(result.current.contributions).toEqual([]);
  });

  it('sets error on fetch failure', async () => {
    vi.spyOn(groupApi, 'fetchGroup').mockRejectedValue(new Error('Server error'));
    const { result } = renderHook(() => useContributions('g1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe('Server error');
    expect(result.current.contributions).toEqual([]);
  });

  it('refresh forces re-fetch', async () => {
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup as any);
    const { result } = renderHook(() => useContributions('g1', { autoRefresh: false }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not auto-refresh when autoRefresh is false', async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(groupApi, 'fetchGroup').mockResolvedValue(mockGroup as any);
    renderHook(() => useContributions('g1', { autoRefresh: false }));
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
