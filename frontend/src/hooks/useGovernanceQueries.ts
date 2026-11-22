/**
 * useGovernanceQueries — React Query bindings for protocol governance.
 *
 * Extracted from `pages/GovernancePage.tsx`, which inlined every query and
 * mutation. Already used the shared `queryKeys.governance.*` keys; kept here so
 * the page and the proposal dialog share one data layer.
 */
import { useMutation, useQuery } from '@tanstack/react-query';

import { queryKeys } from '../lib/queryKeys';
import { castVote, fetchGovernors, fetchProposals } from '../utils/governanceApi';

/** All proposals, polled every 30s while the page is open. */
export function useProposalsQuery() {
  return useQuery({
    queryKey: queryKeys.governance.proposals(),
    queryFn: fetchProposals,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

/** Governor wallet addresses; changes rarely, so cached for 5 minutes. */
export function useGovernorsQuery() {
  return useQuery({
    queryKey: queryKeys.governance.governors(),
    queryFn: fetchGovernors,
    staleTime: 5 * 60_000,
  });
}

/** Cast a vote. Callers supply `onSuccess`/`onError` to update local state. */
export function useCastVoteMutation() {
  return useMutation({
    mutationFn: ({
      proposalId,
      voterAddress,
      support,
    }: {
      proposalId: string;
      voterAddress: string;
      support: boolean;
    }) => castVote(proposalId, voterAddress, support),
  });
}
