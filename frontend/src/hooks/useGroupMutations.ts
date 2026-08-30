import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { createGroup } from '../utils/groupApi';

import type { GroupData } from '../utils/groupApi';

/**
 * Write side of the group list. Separated from useGroupsQuery so a component
 * that only creates groups does not subscribe to list data, and so mutation
 * behaviour can be tested without the query/pagination surface.
 */

export interface UseGroupMutationsReturn {
  createGroup: (data: GroupData) => Promise<string>;
  isCreating: boolean;
  createError: string | null;
  reset: () => void;
}

export function useGroupMutations(): UseGroupMutationsReturn {
  const queryClient = useQueryClient();

  const createMutation = useMutation<string, Error, GroupData>({
    mutationFn: (data: GroupData) => createGroup(data),
    // Any successful write invalidates every group list variant, since a new
    // group can match an arbitrary set of active filters.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all() });
    },
  });

  return {
    createGroup: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error?.message ?? null,
    reset: createMutation.reset,
  };
}

export default useGroupMutations;
