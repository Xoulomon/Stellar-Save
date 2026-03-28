/**
 * payoutApi.ts
 *
 * Orchestration layer for payout operations.
 * Delegates to contractClient and maps raw contract data to typed domain objects.
 * All errors are normalised to ContractError instances.
 */

import type { PayoutEntry, PayoutQueueData, PayoutStatus } from '../types/contribution';
import {
  ContractError,
  parseContractError,
  executePayout as clientExecutePayout,
  getPayoutSchedule,
  hasReceivedPayout,
  getMemberCount,
  getGroupBalance,
} from '../lib/contractClient';
import type { PayoutScheduleEntry } from '../lib/contractClient';

export type { PayoutScheduleEntry };
export { ContractError, parseContractError };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(unixSeconds: bigint): Date {
  return new Date(Number(unixSeconds * 1000n));
}

// ─── getNextRecipient ─────────────────────────────────────────────────────────

export async function getNextRecipient(groupId: string): Promise<string | null> {
  try {
    const gid = BigInt(groupId);
    const schedule = await getPayoutSchedule(gid);
    if (schedule.length === 0) return null;
    for (const entry of schedule) {
      const paid = await hasReceivedPayout(gid, entry.recipient);
      if (!paid) return entry.recipient;
    }
    return null;
  } catch (err) {
    throw parseContractError(err);
  }
}

// ─── executePayout ────────────────────────────────────────────────────────────

export async function executePayout(groupId: string, callerAddress: string): Promise<string> {
  try {
    if (!callerAddress) {
      throw new ContractError(null, 'Wallet is not connected.');
    }
    const recipient = await getNextRecipient(groupId);
    if (recipient === null) {
      throw new ContractError(null, 'No eligible recipient found for payout.');
    }
    return await clientExecutePayout({ groupId: BigInt(groupId), recipient });
  } catch (err) {
    throw parseContractError(err);
  }
}

// ─── getPayoutHistory ─────────────────────────────────────────────────────────

export async function getPayoutHistory(groupId: string): Promise<PayoutEntry[]> {
  try {
    const gid = BigInt(groupId);
    const schedule = await getPayoutSchedule(gid);
    if (schedule.length === 0) return [];

    const results: PayoutEntry[] = [];
    for (let i = 0; i < schedule.length; i++) {
      const entry = schedule[i];
      const paid = await hasReceivedPayout(gid, entry.recipient);
      if (paid) {
        // paidAt is derived from the scheduled payout_date, not an actual on-chain event timestamp
        const payoutDate = toDate(entry.payout_date);
        results.push({
          position: i + 1,
          memberAddress: entry.recipient,
          estimatedDate: payoutDate,
          amount: 0,
          status: 'completed' as PayoutStatus,
          paidAt: payoutDate,
          txHash: undefined,
        });
      }
    }
    return results;
  } catch (err) {
    throw parseContractError(err);
  }
}

// ─── getPayoutQueue ───────────────────────────────────────────────────────────

export async function getPayoutQueue(
  groupId: string,
  currentUserAddress?: string,
): Promise<PayoutQueueData> {
  try {
    const gid = BigInt(groupId);
    const [schedule, totalMembers] = await Promise.all([
      getPayoutSchedule(gid),
      getMemberCount(gid),
    ]);

    if (schedule.length === 0) {
      return { cycleId: 0, totalMembers: 0, entries: [], currentUserAddress };
    }

    const paidFlags = await Promise.all(
      schedule.map((entry) => hasReceivedPayout(gid, entry.recipient)),
    );

    const balance = await getGroupBalance(gid);
    const amountXlm = totalMembers > 0 ? Number(balance) / totalMembers / 10_000_000 : 0;

    let foundNext = false;
    const entries: PayoutEntry[] = schedule.map((entry, i) => {
      const paid = paidFlags[i];
      let status: PayoutStatus;
      if (paid) {
        status = 'completed';
      } else if (!foundNext) {
        status = 'next';
        foundNext = true;
      } else {
        status = 'upcoming';
      }
      return {
        position: i + 1,
        memberAddress: entry.recipient,
        estimatedDate: toDate(entry.payout_date),
        amount: amountXlm,
        status,
        paidAt: paid ? toDate(entry.payout_date) : undefined,
        txHash: undefined,
      };
    });

    const nextIdx = entries.findIndex((e) => e.status === 'next');
    const cycleId = nextIdx >= 0 ? (schedule[nextIdx]?.cycle ?? 0) : 0;

    return { cycleId, totalMembers, entries, currentUserAddress };
  } catch (err) {
    throw parseContractError(err);
  }
}
