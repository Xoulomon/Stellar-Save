/**
 * client.ts
 *
 * Centralised, typed SDK client for the StellarSave smart contract.
 *
 * All contract interactions go through this class. Components and hooks
 * should import the `stellarSaveClient` singleton rather than calling
 * `contractClient` functions directly.
 *
 * @example
 * ```ts
 * import { stellarSaveClient } from '../lib/client';
 *
 * // Read-only (no wallet required)
 * const group = await stellarSaveClient.getGroup(1n);
 *
 * // Write (requires connected wallet / Freighter)
 * const txHash = await stellarSaveClient.joinGroup({ groupId: 1n, member: address });
 * ```
 */

import {
  createGroup as _createGroup,
  getGroup as _getGroup,
  listGroups as _listGroups,
  getTotalGroups as _getTotalGroups,
  joinGroup as _joinGroup,
  contribute as _contribute,
  activateGroup as _activateGroup,
  executePayout as _executePayout,
  isPayoutDue as _isPayoutDue,
  getMemberCount as _getMemberCount,
  getPayoutPosition as _getPayoutPosition,
  hasReceivedPayout as _hasReceivedPayout,
  getMemberTotalContributions as _getMemberTotalContributions,
  getGroupBalance as _getGroupBalance,
  getPayoutSchedule as _getPayoutSchedule,
  getContributionDeadline as _getContributionDeadline,
  isCycleComplete as _isCycleComplete,
  pauseGroup as _pauseGroup,
  resumeGroup as _resumeGroup,
  ContractError,
  parseContractError,
  CONTRACT_ERROR_MESSAGES,
  CONTRACT_ID,
  server,
} from './contractClient';

import type {
  CreateGroupParams,
  JoinGroupParams,
  ContributeParams,
  ActivateGroupParams,
  ExecutePayoutParams,
  PauseGroupParams,
  PayoutScheduleEntry,
} from './contractClient';

// Re-export param types so callers only need to import from this module
export type {
  CreateGroupParams,
  JoinGroupParams,
  ContributeParams,
  ActivateGroupParams,
  ExecutePayoutParams,
  PauseGroupParams,
  PayoutScheduleEntry,
};

export { ContractError, parseContractError, CONTRACT_ERROR_MESSAGES, CONTRACT_ID, server };

// ─── StellarSaveClient ────────────────────────────────────────────────────────

/**
 * Typed SDK client for the StellarSave Soroban contract.
 *
 * Wraps all low-level `contractClient` functions as instance methods so that:
 * - IDE autocomplete works on every method and parameter
 * - Callers have a single import point (`stellarSaveClient`)
 * - The implementation can be swapped or mocked in tests
 */
export class StellarSaveClient {
  // ── Write operations (require Freighter wallet) ───────────────────────────

  /**
   * Deploy a new savings group on-chain.
   *
   * @param params.creator         - Stellar address of the group creator (signs the tx)
   * @param params.contributionAmount - Required contribution per cycle, in stroops (1 XLM = 10_000_000)
   * @param params.cycleDuration   - Duration of each cycle in seconds
   * @param params.maxMembers      - Maximum number of members allowed
   * @returns The newly created group ID as a bigint
   */
  createGroup(params: CreateGroupParams): Promise<bigint> {
    return _createGroup(params);
  }

  /**
   * Join an existing savings group.
   *
   * @param params.groupId - ID of the group to join
   * @param params.member  - Stellar address of the joining member (signs the tx)
   * @returns Transaction hash
   */
  joinGroup(params: JoinGroupParams): Promise<string> {
    return _joinGroup(params);
  }

  /**
   * Submit a contribution for the current cycle.
   *
   * @param params.groupId - ID of the group
   * @param params.member  - Stellar address of the contributing member (signs the tx)
   * @param params.amount  - Contribution amount in stroops
   * @returns Transaction hash
   */
  contribute(params: ContributeParams): Promise<string> {
    return _contribute(params);
  }

  /**
   * Activate a group once the minimum member threshold is reached.
   * Only the group creator can call this.
   *
   * @param params.groupId - ID of the group to activate
   * @param params.creator - Stellar address of the creator (signs the tx)
   * @returns Transaction hash
   */
  activateGroup(params: ActivateGroupParams): Promise<string> {
    return _activateGroup(params);
  }

  /**
   * Execute the payout for the current cycle to the designated recipient.
   *
   * @param params.groupId   - ID of the group
   * @param params.recipient - Stellar address of the payout recipient (signs the tx)
   * @returns Transaction hash
   */
  executePayout(params: ExecutePayoutParams): Promise<string> {
    return _executePayout(params);
  }

  /**
   * Pause a group, halting contributions and payouts.
   * Only the group creator can call this.
   *
   * @param params.groupId - ID of the group to pause
   * @param params.caller  - Stellar address of the creator (signs the tx)
   * @returns Transaction hash
   */
  pauseGroup(params: PauseGroupParams): Promise<string> {
    return _pauseGroup(params);
  }

  /**
   * Resume a previously paused group.
   * Only the group creator can call this.
   *
   * @param params.groupId - ID of the group to resume
   * @param params.caller  - Stellar address of the creator (signs the tx)
   * @returns Transaction hash
   */
  resumeGroup(params: PauseGroupParams): Promise<string> {
    return _resumeGroup(params);
  }

  // ── Read operations (no wallet required) ─────────────────────────────────

  /**
   * Fetch the full state of a group by its ID.
   *
   * @param groupId - The group ID
   * @returns Raw group struct as a plain object (keys mirror the Rust struct fields)
   */
  getGroup(groupId: bigint): Promise<Record<string, unknown>> {
    return _getGroup(groupId);
  }

  /**
   * List groups with optional cursor-based pagination and status filter.
   *
   * @param cursor       - Start listing from this group ID (exclusive); use `0n` for the first page
   * @param limit        - Maximum number of groups to return
   * @param statusFilter - Optional status string to filter by (e.g. `'Active'`)
   * @returns Array of raw group objects
   */
  listGroups(
    cursor: bigint,
    limit: number,
    statusFilter?: string,
  ): Promise<Record<string, unknown>[]> {
    return _listGroups(cursor, limit, statusFilter);
  }

  /**
   * Return the total number of groups ever created.
   *
   * @returns Total group count as a bigint
   */
  getTotalGroups(): Promise<bigint> {
    return _getTotalGroups();
  }

  /**
   * Return the current number of members in a group.
   *
   * @param groupId - The group ID
   * @returns Member count
   */
  getMemberCount(groupId: bigint): Promise<number> {
    return _getMemberCount(groupId);
  }

  /**
   * Return the payout position (1-based) of a member within a group.
   *
   * @param groupId       - The group ID
   * @param memberAddress - Stellar address of the member
   * @returns 1-based position in the payout queue
   */
  getPayoutPosition(groupId: bigint, memberAddress: string): Promise<number> {
    return _getPayoutPosition(groupId, memberAddress);
  }

  /**
   * Check whether a member has already received their payout.
   *
   * @param groupId       - The group ID
   * @param memberAddress - Stellar address of the member
   * @returns `true` if the member has been paid out
   */
  hasReceivedPayout(groupId: bigint, memberAddress: string): Promise<boolean> {
    return _hasReceivedPayout(groupId, memberAddress);
  }

  /**
   * Return the total amount contributed by a member across all cycles.
   *
   * @param groupId       - The group ID
   * @param memberAddress - Stellar address of the member
   * @returns Total contributions in stroops
   */
  getMemberTotalContributions(groupId: bigint, memberAddress: string): Promise<bigint> {
    return _getMemberTotalContributions(groupId, memberAddress);
  }

  /**
   * Return the current escrow balance of a group.
   *
   * @param groupId - The group ID
   * @returns Balance in stroops
   */
  getGroupBalance(groupId: bigint): Promise<bigint> {
    return _getGroupBalance(groupId);
  }

  /**
   * Return the full payout schedule for a group.
   *
   * @param groupId - The group ID
   * @returns Array of `{ recipient, cycle, payout_date }` entries
   */
  getPayoutSchedule(groupId: bigint): Promise<PayoutScheduleEntry[]> {
    return _getPayoutSchedule(groupId);
  }

  /**
   * Return the contribution deadline (Unix timestamp) for a specific cycle.
   *
   * @param groupId     - The group ID
   * @param cycleNumber - The cycle number (0-based)
   * @returns Deadline as a Unix timestamp in seconds (bigint)
   */
  getContributionDeadline(groupId: bigint, cycleNumber: number): Promise<bigint> {
    return _getContributionDeadline(groupId, cycleNumber);
  }

  /**
   * Check whether all members have contributed in a given cycle.
   *
   * @param groupId     - The group ID
   * @param cycleNumber - The cycle number (0-based)
   * @returns `true` if the cycle is complete
   */
  isCycleComplete(groupId: bigint, cycleNumber: number): Promise<boolean> {
    return _isCycleComplete(groupId, cycleNumber);
  }

  /**
   * Check whether a payout is currently due for a group.
   *
   * @param groupId - The group ID
   * @returns `true` if a payout can be executed
   */
  isPayoutDue(groupId: bigint): Promise<boolean> {
    return _isPayoutDue(groupId);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Pre-instantiated `StellarSaveClient` singleton.
 * Import this in components, hooks, and utilities instead of calling
 * `contractClient` functions directly.
 *
 * @example
 * ```ts
 * import { stellarSaveClient } from '../lib/client';
 * const balance = await stellarSaveClient.getGroupBalance(groupId);
 * ```
 */
export const stellarSaveClient = new StellarSaveClient();
