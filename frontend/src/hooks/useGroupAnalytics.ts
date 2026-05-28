import { useMemo } from 'react';
import { useGroup } from './useGroup';
import { useContributions } from './useContributions';
import type { CycleRate, GroupAnalyticsResult } from '../types/analytics';
import type { GroupCycle, GroupContribution } from '../utils/groupApi';

/**
 * Computes per-cycle contribution rates from cycles and contributions.
 * A contribution is counted for a cycle if its timestamp falls within
 * [cycle.startDate, cycle.endDate] and its status is 'completed'.
 */
function computeCycleRates(
  cycles: GroupCycle[],
  contributions: GroupContribution[],
  maxMembers: number,
): CycleRate[] {
  const completedCycles = cycles.filter((c) => c.status === 'completed');
  return completedCycles.map((cycle) => {
    const contributorsInCycle = contributions.filter(
      (c) =>
        c.status === 'completed' &&
        c.timestamp >= cycle.startDate &&
        c.timestamp <= cycle.endDate,
    ).length;
    const totalMembersInCycle = maxMembers;
    const rate =
      totalMembersInCycle > 0
        ? Math.round((contributorsInCycle / totalMembersInCycle) * 1000) / 10
        : 0;
    return { cycleNumber: cycle.cycleNumber, contributorsInCycle, totalMembersInCycle, rate };
  });
}

/**
 * Computes the on-time payment percentage across all completed cycles.
 * A contribution is on-time if its timestamp is before the cycle's endDate.
 */
function computeOnTimePercent(
  cycles: GroupCycle[],
  contributions: GroupContribution[],
  maxMembers: number,
): number {
  const completedCycles = cycles.filter((c) => c.status === 'completed');
  const totalExpected = completedCycles.length * maxMembers;
  if (totalExpected === 0) return 0;

  const onTime = contributions.filter((c) => {
    if (c.status !== 'completed') return false;
    const cycle = completedCycles.find(
      (cy) => c.timestamp >= cy.startDate && c.timestamp <= cy.endDate,
    );
    return cycle !== undefined && c.timestamp < cycle.endDate;
  }).length;

  return Math.round((onTime / totalExpected) * 1000) / 10;
}

/**
 * Dedicated hook for group analytics data.
 * Composes useGroup and useContributions; all computation is done here
 * so the page component stays declarative.
 *
 * @param groupId - Pass null/undefined to skip fetching.
 */
export function useGroupAnalytics(
  groupId: string | null | undefined,
): GroupAnalyticsResult {
  const { group, isLoading: groupLoading, error: groupError } = useGroup(groupId);
  const {
    contributions,
    isLoading: contribLoading,
    error: contribError,
  } = useContributions(groupId);

  const isLoading = groupLoading || contribLoading;
  const error = groupError ?? contribError ?? null;

  const cycleRates = useMemo<CycleRate[]>(() => {
    if (!group || !group.maxMembers) return [];
    // DetailedGroup has cycles; GroupDetail (from useGroup) may not expose them directly.
    // We derive from contributions and currentCycle available on the group object.
    // Since useGroup returns GroupDetail (no cycles array), we fall back to an empty array
    // and let the contributions hook supply cycle context via currentCycle.
    // When the API is wired to real data, cycles will be available on the group object.
    const cycles: GroupCycle[] = (group as unknown as { cycles?: GroupCycle[] }).cycles ?? [];
    return computeCycleRates(cycles, contributions, group.maxMembers);
  }, [group, contributions]);

  const onTimePercent = useMemo<number | null>(() => {
    if (isLoading || !group) return null;
    const cycles: GroupCycle[] = (group as unknown as { cycles?: GroupCycle[] }).cycles ?? [];
    return computeOnTimePercent(cycles, contributions, group.maxMembers ?? 0);
  }, [group, contributions, isLoading]);

  const projectedCompletionDate = useMemo<Date | null>(() => {
    if (!group || group.startedAt === null || group.startedAt === undefined) return null;
    const { startedAt, maxMembers, cycleDuration } = group;
    if (!maxMembers || !cycleDuration) return null;
    return new Date(startedAt.getTime() + maxMembers * cycleDuration * 1000);
  }, [group]);

  return { cycleRates, onTimePercent, projectedCompletionDate, isLoading, error };
import { useEffect, useState } from 'react';
import type { AnalyticsData, ContributionDataPoint, MemberComparisonItem } from '../types/analytics';
import { DetailedGroup, fetchGroup } from '../utils/groupApi';
import { useWallet } from './useWallet';
function calculateOnTimePaymentRate(group: DetailedGroup): number {
  if (!group.contributions || group.contributions.length === 0) {
    return 0;
  }

  const completedContributions = group.contributions.filter(c => c.status === 'completed');
  if (completedContributions.length === 0) {
    return 0;
  }

  let onTimeCount = 0;
  for (const contribution of completedContributions) {
    const cycle = group.cycles.find(c =>
      contribution.timestamp >= c.startDate && contribution.timestamp <= c.endDate
    );
    if (cycle) {
      onTimeCount++;
    }
  }

  return (onTimeCount / completedContributions.length) * 100;
}

// Helper to calculate projected completion date
function calculateProjectedCompletionDate(group: DetailedGroup): string {
  if (!group.cycles || group.cycles.length === 0 || !group.currentCycle) {
    return 'N/A';
  }

  const totalCycles = group.totalMembers; // Assuming each member gets a payout once
  const completedCycles = group.cycles.filter(c => c.status === 'completed').length;
  const remainingCycles = totalCycles - completedCycles;

  if (remainingCycles <= 0) {
    return group.cycles[group.cycles.length - 1].endDate.toISOString().split('T')[0];
  }

  const lastCompletedCycleEndDate = group.currentCycle.endDate;
  const projectedDate = new Date(lastCompletedCycleEndDate);

  // Assuming monthly cycles for simplicity, need more robust logic for other frequencies
  for (let i = 0; i < remainingCycles; i++) {
    projectedDate.setMonth(projectedDate.getMonth() + 1);
  }

  return projectedDate.toISOString().split('T')[0];
}

// Helper to generate per-cycle contribution rates
function generatePerCycleContributionRates(group: DetailedGroup): ContributionDataPoint[] {
  if (!group.cycles || group.cycles.length === 0) {
    return [];
  }

  return group.cycles.map(cycle => {
    const contributedAmount = group.contributions
      .filter(c => c.status === 'completed' && c.timestamp >= cycle.startDate && c.timestamp <= cycle.endDate)
      .reduce((sum, c) => sum + c.amount, 0);

    const expectedAmount = cycle.targetAmount;
    const contributionRate = expectedAmount > 0 ? (contributedAmount / expectedAmount) * 100 : 0;

    return {
      cycle: `Cycle ${cycle.cycleNumber}`,
      contributionRate: Math.min(Math.round(contributionRate), 100), // Cap at 100%
    };
  });
}

// Hook to fetch analytics data for a specific group
export function useGroupAnalytics(groupId: string): AnalyticsData {
  const { activeAddress } = useWallet();
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    stats: { onTimePaymentRate: 0, projectedCompletionDate: '' },
    history: [],
    memberComparison: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const fetchGroupData = async () => {
      setAnalyticsData((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const group = await fetchGroup(groupId);
        if (!group) {
          throw new Error('Group not found');
        }

        const onTimePaymentRate = calculateOnTimePaymentRate(group);
        const projectedCompletionDate = calculateProjectedCompletionDate(group);
        const history = generatePerCycleContributionRates(group);

        // TODO: Populate real member comparison data
        const memberComparison: MemberComparisonItem[] = [
          { address: activeAddress || 'GSELF...', label: 'You', onTimePercent: onTimePaymentRate },
          // Add other members if needed, calculating their individual on-time rates
        ];

        setAnalyticsData({
          stats: {
            onTimePaymentRate,
            projectedCompletionDate,
          },
          history,
          memberComparison,
          isLoading: false,
          error: null,
        });

      } catch (err) {
        console.error('Failed to fetch group analytics:', err);
        setAnalyticsData((prev) => ({ ...prev, isLoading: false, error: (err as Error).message }));
      }
    };

    fetchGroupData();
  }, [groupId, activeAddress]);

  return analyticsData;
}
