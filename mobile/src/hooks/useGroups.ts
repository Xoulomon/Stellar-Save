/**
 * useGroups.ts
 *
 * React Query-backed hook for the group list.
 * Mirrors the frontend useGroups pattern: list data, loading state,
 * pull-to-refresh invalidation.
 */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listGroups, type Group } from '../services/contractService';

const GROUPS_QUERY_KEY = ['groups', 'list'] as const;
const STALE_TIME_MS = 30_000;

export interface UseGroupsReturn {
  groups: Group[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useGroups(): UseGroupsReturn {
  const queryClient = useQueryClient();

  const { data = [], isLoading, error } = useQuery<Group[], Error>({
    queryKey: GROUPS_QUERY_KEY,
    queryFn: listGroups,
    staleTime: STALE_TIME_MS,
    retry: 2,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: GROUPS_QUERY_KEY });
  }, [queryClient]);

  return {
    groups: data,
    isLoading,
    error: error?.message ?? null,
    refresh,
  };
}
