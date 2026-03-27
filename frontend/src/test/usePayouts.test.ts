import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock contractClient before `useContract` imports it (avoids SorobanRpc initialization in tests)
vi.mock('../lib/contractClient', () => ({
  ContractError: class ContractError extends Error {},
  parseContractError: (raw: unknown) => (raw instanceof Error ? raw : new Error(String(raw))),
  createGroup: vi.fn(),
  getGroup: vi.fn(),
  listGroups: vi.fn(),
  getTotalGroups: vi.fn(),
  joinGroup: vi.fn(),
  contribute: vi.fn(),
  activateGroup: vi.fn(),
  executePayout: vi.fn(),
  isPayoutDue: vi.fn(),
  getMemberCount: vi.fn(),
  getPayoutPosition: vi.fn(),
  hasReceivedPayout: vi.fn(),
  getMemberTotalContributions: vi.fn(),
  getGroupBalance: vi.fn(),
  getPayoutSchedule: vi.fn(),
  getContributionDeadline: vi.fn(),
  isCycleComplete: vi.fn(),
  pauseGroup: vi.fn(),
  resumeGroup: vi.fn(),
}));

import * as contractHook from '../hooks/useContract';
import { usePayouts } from '../hooks/usePayouts';

const scheduleMock = [
  { recipient: 'GA11111', cycle: 0, payout_date: 1700000000n },
  { recipient: 'GA22222', cycle: 1, payout_date: 1700003600n },
  { recipient: 'GA33333', cycle: 2, payout_date: 1700007200n },
];

const groupMock = {
  current_cycle: 1,
  contribution_amount: 500000000n,
  max_members: 3,
};

describe('usePayouts', () => {
  let getPayoutScheduleSpy: ReturnType<typeof vi.spyOn>;
  let getGroupSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    getPayoutScheduleSpy = vi.spyOn(contractHook, 'useContract').mockReturnValue({
      getPayoutSchedule: vi.fn().mockResolvedValue(scheduleMock),
      getGroup: vi.fn().mockResolvedValue(groupMock),
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches initial payout queue and history', async () => {
    const { result } = renderHook(() => usePayouts('1'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.queue).not.toBeNull();
    expect(result.current.queue?.totalMembers).toBe(3);
    expect(result.current.queue?.cycleId).toBe(2); // current_cycle + 1

    const entries = result.current.queue?.entries ?? [];
    expect(entries).toHaveLength(3);
    expect(entries.filter((item) => item.status === 'completed')).toHaveLength(1);
    expect(entries.filter((item) => item.status === 'next')).toHaveLength(1);
    expect(entries.filter((item) => item.status === 'upcoming')).toHaveLength(1);

    const history = result.current.history;
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('completed');
  });

  it('handles invalid group ID format', async () => {
    const { result } = renderHook(() => usePayouts('invalid-id'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.queue).toBeNull();
    expect(result.current.history).toHaveLength(0);
    expect(result.current.error).toBe('Invalid group ID');
  });

  it('unsupported contract failure returns error', async () => {
    getPayoutScheduleSpy.mockReturnValue({
      getPayoutSchedule: vi.fn().mockRejectedValue(new Error('Contract unavailable')),
      getGroup: vi.fn().mockResolvedValue(groupMock),
    } as any);

    const { result } = renderHook(() => usePayouts('2'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toContain('Contract unavailable');
    expect(result.current.queue).toBeNull();
    expect(result.current.history).toHaveLength(0);
  });

  it('refresh bypasses cache and re-fetches data', async () => {
    const getPayoutScheduleFunc = vi.fn().mockResolvedValue(scheduleMock);
    const getGroupFunc = vi.fn().mockResolvedValue(groupMock);

    vi.spyOn(contractHook, 'useContract').mockReturnValue({
      getPayoutSchedule: getPayoutScheduleFunc,
      getGroup: getGroupFunc,
    } as any);

    const { result } = renderHook(() => usePayouts('3'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getPayoutScheduleFunc).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getPayoutScheduleFunc).toHaveBeenCalledTimes(2);
  });
});
