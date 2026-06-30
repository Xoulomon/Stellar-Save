import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchGroup } from '../utils/groupApi';
import { queryKeys } from '../lib/queryKeys';
import { STALE_TIME } from '../lib/queryClient';
import type { GroupDetail, UseGroupReturn } from '../types/group';

/**
 * Fetches a single group by ID.
 *
 * staleTime: 30_000 — group state (member count, status, config) changes
 * infrequently, so we avoid redundant RPC calls for 30 seconds.
 */
export function useGroup(
  groupId: string | null | undefined,
): UseGroupReturn {
  const queryClient = useQueryClient();

  const { data: group = null, isLoading, error, refetch } = useQuery<GroupDetail | null, Error>({
    queryKey: queryKeys.groups.detail(groupId ?? ''),
    queryFn: () => fetchGroup(groupId!),
    enabled: Boolean(groupId),
    staleTime: STALE_TIME.GROUP_STATE,
    select: (data) => data ?? null,
  });

  const refresh = () => {
    if (groupId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
    }
  };

  return {
    group,
    isLoading,
    error: error?.message ?? null,
    refresh,
  };
}

/** Prefetch a group into the cache — call on hover before navigation. */
export function usePrefetchGroup() {
  const queryClient = useQueryClient();
  return (groupId: string) => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.groups.detail(groupId),
      queryFn: () => fetchGroup(groupId),
      staleTime: STALE_TIME.GROUP_STATE,
    });
  };
}

// Keep backward-compat export for tests
export function clearGroupCache() {
  // no-op — React Query manages its own cache
}
