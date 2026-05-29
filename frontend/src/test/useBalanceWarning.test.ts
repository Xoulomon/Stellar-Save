import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBalanceWarning } from '../hooks/useBalanceWarning';
import type { DashboardGroup } from '../types/dashboard';

vi.mock('../hooks/useBalance', () => ({
  useBalance: vi.fn(),
}));

import { useBalance } from '../hooks/useBalance';

const mockUseBalance = useBalance as ReturnType<typeof vi.fn>;

const activeGroups: DashboardGroup[] = [
  { id: '1', name: 'Group A', currentCycle: 1, totalCycles: 5, contributionAmount: 300, currency: 'XLM', status: 'active' },
  { id: '2', name: 'Group B', currentCycle: 2, totalCycles: 5, contributionAmount: 200, currency: 'XLM', status: 'active' },
  { id: '3', name: 'Group C', currentCycle: 3, totalCycles: 5, contributionAmount: 100, currency: 'XLM', status: 'completed' },
];

describe('useBalanceWarning', () => {
  it('returns isInsufficient=false when balance covers all active groups', () => {
    mockUseBalance.mockReturnValue({ xlmBalance: '600' });
    const { result } = renderHook(() => useBalanceWarning(activeGroups));
    expect(result.current.isInsufficient).toBe(false);
    expect(result.current.shortfall).toBe(0);
  });

  it('returns isInsufficient=true when balance is below required amount', () => {
    mockUseBalance.mockReturnValue({ xlmBalance: '400' });
    const { result } = renderHook(() => useBalanceWarning(activeGroups));
    expect(result.current.isInsufficient).toBe(true);
    expect(result.current.requiredAmount).toBe(500); // 300 + 200 (completed group excluded)
    expect(result.current.shortfall).toBe(100);
  });

  it('treats null balance as 0', () => {
    mockUseBalance.mockReturnValue({ xlmBalance: null });
    const { result } = renderHook(() => useBalanceWarning(activeGroups));
    expect(result.current.currentBalance).toBe(0);
    expect(result.current.isInsufficient).toBe(true);
    expect(result.current.shortfall).toBe(500);
  });

  it('returns isInsufficient=false when there are no active groups', () => {
    mockUseBalance.mockReturnValue({ xlmBalance: '0' });
    const { result } = renderHook(() => useBalanceWarning([]));
    expect(result.current.isInsufficient).toBe(false);
    expect(result.current.requiredAmount).toBe(0);
  });

  it('excludes completed and pending groups from required amount', () => {
    mockUseBalance.mockReturnValue({ xlmBalance: '0' });
    const groups: DashboardGroup[] = [
      { id: '1', name: 'Done', currentCycle: 5, totalCycles: 5, contributionAmount: 999, currency: 'XLM', status: 'completed' },
      { id: '2', name: 'Pending', currentCycle: 0, totalCycles: 5, contributionAmount: 999, currency: 'XLM', status: 'pending' },
    ];
    const { result } = renderHook(() => useBalanceWarning(groups));
    expect(result.current.requiredAmount).toBe(0);
    expect(result.current.isInsufficient).toBe(false);
  });
});
