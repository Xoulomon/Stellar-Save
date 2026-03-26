/**
 * useContract.ts
 *
 * React hook for all StellarSave smart contract interactions.
 *
 * Design decisions:
 * - Separates read (query) state from write (mutation) state so the UI can
 *   show fine-grained loading indicators.
 * - Every mutation returns { txHash, error } so callers can react to both
 *   success and failure without try/catch boilerplate.
 * - Read methods are plain async functions (not auto-fetching) so callers
 *   decide when to trigger them — consistent with useGroup / useGroups.
 * - The hook is wallet-aware: it reads activeAddress from useWallet() and
 *   injects it automatically where the contract requires the caller's address.
 */

import { useCallback, useState } from 'react';
import { useWallet } from './useWallet';
import {
  ContractError,
  parseContractError,
  createGroup as clientCreateGroup,
  getGroup as clientGetGroup,
  listGroups as clientListGroups,
  getTotalGroups as clientGetTotalGroups,
  joinGroup as clientJoinGroup,
  contribute as clientContribute,
  activateGroup as clientActivateGroup,
  executePayout as clientExecutePayout,
  isPayoutDue as clientIsPayoutDue,
  getMemberCount as clientGetMemberCount,
  getPayoutPosition as clientGetPayoutPosition,
  hasReceivedPayout as clientHasReceivedPayout,
  getMemberTotalContributions as clientGetMemberTotalContributions,
  getGroupBalance as clientGetGroupBalance,
  getPayoutSchedule as clientGetPayoutSchedule,
  getContributionDeadline as clientGetContributionDeadline,
  isCycleComplete as clientIsCycleComplete,
  pauseGroup as clientPauseGroup,
  resumeGroup as clientResumeGroup,
} from '../lib/contractClient';
import type {
  CreateGroupParams,
  JoinGroupParams,
  ContributeParams,
  ActivateGroupParams,
  ExecutePayoutParams,
  PauseGroupParams,
  PayoutScheduleEntry,
} from '../lib/contractClient';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result shape for every write (mutation) operation. */
export interface MutationResult {
  txHash: string | null;
  error: ContractError | null;
}

/** Granular loading state so the UI can disable specific buttons. */
export interface ContractLoadingState {
  createGroup: boolean;
  joinGroup: boolean;
  contribute: boolean;
  activateGroup: boolean;
  executePayout: boolean;
  pauseGroup: boolean;
  resumeGroup: boolean;
}

export interface UseContractReturn {
  // ── State ──────────────────────────────────────────────────────────────────
  /** Per-operation loading flags for mutations */
  loading: ContractLoadingState;
  /** Last error from any operation (cleared on next call) */
  lastError: ContractError | null;
  /** Whether the wallet is connected and ready to sign */
  isReady: boolean;

  // ── Write operations (require wallet) ─────────────────────────────────────
  createGroup: (params: Omit<CreateGroupParams, 'creator'>) => Promise<MutationResult>;
  joinGroup: (params: Omit<JoinGroupParams, 'member'>) => Promise<MutationResult>;
  contribute: (params: Omit<ContributeParams, 'member'>) => Promise<MutationResult>;
  activateGroup: (params: Omit<ActivateGroupParams, 'creator'>) => Promise<MutationResult>;
  executePayout: (params: Omit<ExecutePayoutParams, 'recipient'>) => Promise<MutationResult>;
  pauseGroup: (params: Omit<PauseGroupParams, 'caller'>) => Promise<MutationResult>;
  resumeGroup: (params: Omit<PauseGroupParams, 'caller'>) => Promise<MutationResult>;

  // ── Read operations (no wallet required) ──────────────────────────────────
  getGroup: (groupId: bigint) => Promise<Record<string, unknown>>;
  listGroups: (cursor: bigint, limit: number, statusFilter?: string) => Promise<Record<string, unknown>[]>;
  getTotalGroups: () => Promise<bigint>;
  getMemberCount: (groupId: bigint) => Promise<number>;
  getPayoutPosition: (groupId: bigint, memberAddress: string) => Promise<number>;
  hasReceivedPayout: (groupId: bigint, memberAddress: string) => Promise<boolean>;
  getMemberTotalContributions: (groupId: bigint, memberAddress: string) => Promise<bigint>;
  getGroupBalance: (groupId: bigint) => Promise<bigint>;
  getPayoutSchedule: (groupId: bigint) => Promise<PayoutScheduleEntry[]>;
  getContributionDeadline: (groupId: bigint, cycleNumber: number) => Promise<bigint>;
  isCycleComplete: (groupId: bigint, cycleNumber: number) => Promise<boolean>;
  isPayoutDue: (groupId: bigint) => Promise<boolean>;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_LOADING: ContractLoadingState = {
  createGroup: false,
  joinGroup: false,
  contribute: false,
  activateGroup: false,
  executePayout: false,
  pauseGroup: false,
  resumeGroup: false,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useContract(): UseContractReturn {
  const { activeAddress, status } = useWallet();
  const isReady = status === 'connected' && activeAddress !== null;

  const [loading, setLoading] = useState<ContractLoadingState>(INITIAL_LOADING);
  const [lastError, setLastError] = useState<ContractError | null>(null);

  /**
   * Shared wrapper for all write operations:
   * - Guards against disconnected wallet
   * - Sets per-operation loading flag
   * - Normalises errors into ContractError
   */
  async function runMutation<TParams>(
    key: keyof ContractLoadingState,
    params: TParams,
    fn: (p: TParams) => Promise<string>,
  ): Promise<MutationResult> {
    if (!isReady || !activeAddress) {
      const err = new ContractError(null, 'Wallet is not connected.');
      setLastError(err);
      return { txHash: null, error: err };
    }

    setLastError(null);
    setLoading((prev: ContractLoadingState) => ({ ...prev, [key]: true }));

    try {
      const txHash = await fn(params);
      return { txHash, error: null };
    } catch (raw) {
      const err = raw instanceof ContractError ? raw : parseContractError(raw);
      setLastError(err);
      return { txHash: null, error: err };
    } finally {
      setLoading((prev: ContractLoadingState) => ({ ...prev, [key]: false }));
    }
  }

  // ── Write operations ───────────────────────────────────────────────────────

  const createGroup = useCallback(
    (params: Omit<CreateGroupParams, 'creator'>) =>
      runMutation('createGroup', params, (p) =>
        clientCreateGroup({ ...p, creator: activeAddress! }).then(String),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReady, activeAddress],
  );

  const joinGroup = useCallback(
    (params: Omit<JoinGroupParams, 'member'>) =>
      runMutation('joinGroup', params, (p) =>
        clientJoinGroup({ ...p, member: activeAddress! }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReady, activeAddress],
  );

  const contribute = useCallback(
    (params: Omit<ContributeParams, 'member'>) =>
      runMutation('contribute', params, (p) =>
        clientContribute({ ...p, member: activeAddress! }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReady, activeAddress],
  );

  const activateGroup = useCallback(
    (params: Omit<ActivateGroupParams, 'creator'>) =>
      runMutation('activateGroup', params, (p) =>
        clientActivateGroup({ ...p, creator: activeAddress! }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReady, activeAddress],
  );

  const executePayout = useCallback(
    (params: Omit<ExecutePayoutParams, 'recipient'>) =>
      runMutation('executePayout', params, (p) =>
        clientExecutePayout({ ...p, recipient: activeAddress! }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReady, activeAddress],
  );

  const pauseGroup = useCallback(
    (params: Omit<PauseGroupParams, 'caller'>) =>
      runMutation('pauseGroup', params, (p) =>
        clientPauseGroup({ ...p, caller: activeAddress! }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReady, activeAddress],
  );

  const resumeGroup = useCallback(
    (params: Omit<PauseGroupParams, 'caller'>) =>
      runMutation('resumeGroup', params, (p) =>
        clientResumeGroup({ ...p, caller: activeAddress! }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isReady, activeAddress],
  );

  // ── Read operations ────────────────────────────────────────────────────────

  const getGroup = useCallback(
    (groupId: bigint) => clientGetGroup(groupId),
    [],
  );

  const listGroups = useCallback(
    (cursor: bigint, limit: number, statusFilter?: string) =>
      clientListGroups(cursor, limit, statusFilter),
    [],
  );

  const getTotalGroups = useCallback(() => clientGetTotalGroups(), []);

  const getMemberCount = useCallback(
    (groupId: bigint) => clientGetMemberCount(groupId),
    [],
  );

  const getPayoutPosition = useCallback(
    (groupId: bigint, memberAddress: string) =>
      clientGetPayoutPosition(groupId, memberAddress),
    [],
  );

  const hasReceivedPayout = useCallback(
    (groupId: bigint, memberAddress: string) =>
      clientHasReceivedPayout(groupId, memberAddress),
    [],
  );

  const getMemberTotalContributions = useCallback(
    (groupId: bigint, memberAddress: string) =>
      clientGetMemberTotalContributions(groupId, memberAddress),
    [],
  );

  const getGroupBalance = useCallback(
    (groupId: bigint) => clientGetGroupBalance(groupId),
    [],
  );

  const getPayoutSchedule = useCallback(
    (groupId: bigint) => clientGetPayoutSchedule(groupId),
    [],
  );

  const getContributionDeadline = useCallback(
    (groupId: bigint, cycleNumber: number) =>
      clientGetContributionDeadline(groupId, cycleNumber),
    [],
  );

  const isCycleComplete = useCallback(
    (groupId: bigint, cycleNumber: number) =>
      clientIsCycleComplete(groupId, cycleNumber),
    [],
  );

  const isPayoutDue = useCallback(
    (groupId: bigint) => clientIsPayoutDue(groupId),
    [],
  );

  return {
    loading,
    lastError,
    isReady,
    // mutations
    createGroup,
    joinGroup,
    contribute,
    activateGroup,
    executePayout,
    pauseGroup,
    resumeGroup,
    // reads
    getGroup,
    listGroups,
    getTotalGroups,
    getMemberCount,
    getPayoutPosition,
    hasReceivedPayout,
    getMemberTotalContributions,
    getGroupBalance,
    getPayoutSchedule,
    getContributionDeadline,
    isCycleComplete,
    isPayoutDue,
  };
}
