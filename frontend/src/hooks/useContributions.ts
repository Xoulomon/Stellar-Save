import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchGroup } from '../utils/groupApi';
import { queryKeys } from '../lib/queryKeys';
import { STALE_TIME } from '../lib/queryClient';
import type { GroupContribution, GroupCycle } from '../utils/groupApi';

export interface ContributionStatusSummary {
  totalContributions: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  totalAmount: number;
  lastContributionDate: Date | null;
}

export interface UseContributionsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseContributionsReturn {
  contributions: GroupContribution[];
  currentCycle: GroupCycle | null;
  status: ContributionStatusSummary;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

interface ContributionData {
  contributions: GroupContribution[];
  currentCycle: GroupCycle | null;
}

/**
 * Fetches contribution status for a group.
 *
 * staleTime: 0 — contribution status (has a member paid this cycle?) must
 * always be fresh. React Query will refetch in the background on every
 * mount and window focus to avoid showing stale payment state.
 */
export function useContributions(
  groupId: string | null | undefined,
  options: UseContributionsOptions = {},
): UseContributionsReturn {
  const { refreshInterval } = options;
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<ContributionData, Error>({
    queryKey: queryKeys.contributions.byGroup(groupId ?? ''),
    queryFn: async () => {
      const group = await fetchGroup(groupId!);
      if (!group) throw new Error('Group not found.');
      return {
        contributions: group.contributions ?? [],
        currentCycle: group.currentCycle ?? null,
      };
    },
    enabled: Boolean(groupId),
    // staleTime: 0 — contribution status must always be fresh
    staleTime: STALE_TIME.CONTRIBUTION_STATUS,
    refetchOnWindowFocus: true,
    ...(refreshInterval ? { refetchInterval: refreshInterval } : {}),
  });

  const contributions = data?.contributions ?? [];
  const currentCycle = data?.currentCycle ?? null;

  const refresh = useCallback(() => {
    if (groupId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.contributions.byGroup(groupId),
      });
    }
  }, [groupId, queryClient]);

  const status = useMemo<ContributionStatusSummary>(() => {
    const totalContributions = contributions.length;
    const completedCount = contributions.filter((c) => c.status === 'completed').length;
    const pendingCount = contributions.filter((c) => c.status === 'pending').length;
    const failedCount = contributions.filter((c) => c.status === 'failed').length;
    const totalAmount = contributions.reduce((sum, c) => sum + (c.amount ?? 0), 0);
    const lastContributionDate =
      contributions
        .map((c) => c.timestamp)
        .filter((d): d is Date => d != null)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    return { totalContributions, completedCount, pendingCount, failedCount, totalAmount, lastContributionDate };
  }, [contributions]);

  return { contributions, currentCycle, status, isLoading, error: error?.message ?? null, refresh };
}

// Keep backward-compat export for tests
export function clearContributionsCache() {
  // no-op — React Query manages its own cache
}
