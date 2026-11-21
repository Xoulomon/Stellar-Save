import type { DetailedGroup } from '../../utils/groupApi';
import type { PayoutEntry } from '../../types/contribution';

/**
 * Pure derivations for the group detail view. No React, no data fetching.
 */
// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemberCycleStatus {
  memberId: string;
  memberName: string;
  address: string;
  cycleStatuses: Record<number, 'paid' | 'unpaid' | 'pending'>;
  totalContributions: number;
  isActive: boolean;
}

/** Build per-member contribution status for each cycle */
export function buildMemberCycleStatuses(group: DetailedGroup): MemberCycleStatus[] {
  return group.members.map((member) => {
    const cycleStatuses: Record<number, 'paid' | 'unpaid' | 'pending'> = {};
    group.cycles.forEach((cycle) => {
      const contribution = group.contributions.find(
        (c) => c.memberId === member.id &&
          new Date(c.timestamp) >= cycle.startDate &&
          new Date(c.timestamp) <= cycle.endDate,
      );
      if (!contribution) {
        cycleStatuses[cycle.cycleNumber] = cycle.status === 'completed' ? 'unpaid' : 'pending';
      } else if (contribution.status === 'completed') {
        cycleStatuses[cycle.cycleNumber] = 'paid';
      } else {
        cycleStatuses[cycle.cycleNumber] = 'pending';
      }
    });
    return {
      memberId: member.id,
      memberName: member.name ?? 'Anonymous',
      address: member.address,
      cycleStatuses,
      totalContributions: member.totalContributions,
      isActive: member.isActive,
    };
  });
}

/** Build payout rotation entries */
export function buildPayoutRotation(group: DetailedGroup): PayoutEntry[] {
  const payoutAmount = group.contributionAmount * group.totalMembers;
  return group.members.map((member, index) => {
    const cycleNum = index + 1;
    const isPast = cycleNum < (group.currentCycle?.cycleNumber ?? 1);
    const isNext = cycleNum === (group.currentCycle?.cycleNumber ?? 1);
    return {
      position: cycleNum,
      memberAddress: member.address,
      memberName: member.name ?? 'Anonymous',
      estimatedDate: new Date(group.createdAt.getTime() + cycleNum * 30 * 86400000),
      amount: payoutAmount,
      status: isPast ? 'completed' : isNext ? 'next' : 'upcoming',
      txHash: isPast ? `tx_payout_${cycleNum}` : undefined,
      paidAt: isPast ? new Date(group.createdAt.getTime() + cycleNum * 30 * 86400000) : undefined,
    };
  });
}
