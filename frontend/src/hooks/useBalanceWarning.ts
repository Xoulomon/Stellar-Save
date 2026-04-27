import { useMemo } from 'react';
import { useBalance } from './useBalance';
import type { DashboardGroup } from '../types/dashboard';

export interface BalanceWarning {
  /** True when the wallet balance is below the total upcoming contribution amount */
  isInsufficient: boolean;
  /** Current XLM balance as a number (0 when unknown) */
  currentBalance: number;
  /** Sum of contribution amounts for all active groups */
  requiredAmount: number;
  /** How much more XLM is needed */
  shortfall: number;
}

/**
 * Compares the live wallet balance against the total upcoming contribution
 * amounts for the user's active groups.
 */
export function useBalanceWarning(activeGroups: DashboardGroup[]): BalanceWarning {
  const { xlmBalance } = useBalance({ fetchOnMount: true });

  return useMemo(() => {
    const currentBalance = xlmBalance ? parseFloat(xlmBalance) : 0;
    const requiredAmount = activeGroups
      .filter((g) => g.status === 'active')
      .reduce((sum, g) => sum + g.contributionAmount, 0);

    const shortfall = Math.max(0, requiredAmount - currentBalance);

    return {
      isInsufficient: requiredAmount > 0 && currentBalance < requiredAmount,
      currentBalance,
      requiredAmount,
      shortfall,
    };
  }, [xlmBalance, activeGroups]);
}
