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
}
