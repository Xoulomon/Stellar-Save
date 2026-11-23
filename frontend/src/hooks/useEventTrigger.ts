/**
 * useEventTrigger.ts
 *
 * Provides a `triggerRefresh(groupId)` helper that invalidates all React Query
 * cache entries tagged with a given group ID.  Consumed by `useGroupEvents` to
 * force a data-refresh whenever a Soroban contract event arrives.
 */
import { useCallback } from 'react';

import { useQueryClient } from '@tanstack/react-query';

export interface UseEventTriggerReturn {
  /** Invalidate all cached queries that belong to the given group. */
  triggerRefresh: (groupId: string) => void;
}

export function useEventTrigger(): UseEventTriggerReturn {
  const queryClient = useQueryClient();

  const triggerRefresh = useCallback(
    (groupId: string) => {
      void queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
    },
    [queryClient],
  );

  return { triggerRefresh };
}
