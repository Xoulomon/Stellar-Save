/**
 * useRecoveryQueries — React Query bindings for social recovery.
 *
 * Extracted from `pages/RecoverySetupPage.tsx`, which previously declared its
 * own `recoveryKeys` factory and inlined every query and mutation. It now uses
 * the centralised `queryKeys.recovery.*` keys like the rest of the app.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import {
  approveRecovery,
  fetchGuardianConfig,
  fetchIncomingRequests,
  setGuardians,
} from '../utils/recoveryApi';

/** Guardian configuration for an account. */
export function useGuardianConfigQuery(ownerAddress: string) {
  return useQuery({
    queryKey: queryKeys.recovery.config(ownerAddress),
    queryFn: () => fetchGuardianConfig(ownerAddress),
  });
}

/** Persist the guardian set and approval threshold to the contract. */
export function useSetGuardiansMutation(ownerAddress: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ guardians, threshold }: { guardians: string[]; threshold: number }) =>
      setGuardians(ownerAddress, guardians, threshold),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recovery.config(ownerAddress) });
    },
  });
}

/** Recovery requests awaiting this guardian's approval, polled every 30s. */
export function useIncomingRecoveryQuery(guardianAddress: string) {
  return useQuery({
    queryKey: queryKeys.recovery.incoming(guardianAddress),
    queryFn: () => fetchIncomingRequests(guardianAddress),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

/** Approve a recovery request as a guardian. */
export function useApproveRecoveryMutation(guardianAddress: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => approveRecovery(requestId, guardianAddress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recovery.incoming(guardianAddress) });
    },
  });
}
