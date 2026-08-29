/**
 * Fixture factory for groups, members, and contributions.
 *
 * Provides deterministic, composable helpers for building realistic multi-user
 * group data in integration and unit tests. Every builder accepts a partial
 * override so callers only specify what matters for a given test, and defaults
 * fill in the rest.
 *
 * @example Basic usage
 * ```ts
 * import { GroupFixtureFactory } from '../fixtures/groups';
 *
 * const { group, members, transactions } =
 *   GroupFixtureFactory.buildGroupWithMembers(5, { contributionAmount: 200 });
 * ```
 *
 * See backend/test/fixtures/README.md for full usage guide.
 */

import { Group, Member, Transaction } from '../../src/models';

// ─── Contribution state ───────────────────────────────────────────────────────

/**
 * Per-member view of one cycle's contribution status. Used to describe
 * "mixed" scenarios where some members have paid and others have not.
 */
export interface MemberContributionState {
  member: Member;
  /** Whether the member has contributed in the current cycle. */
  hasContributed: boolean;
  /** Transaction record — only present when hasContributed is true. */
  transaction?: Transaction;
}

// ─── Built group snapshot ─────────────────────────────────────────────────────

export interface GroupFixture {
  group: Group;
  members: Member[];
  /** All contribution transactions for the current cycle. */
  transactions: Transaction[];
  /**
   * Per-member contribution state. The order mirrors the payout rotation
   * (index 0 is the next recipient).
   */
  contributionStates: MemberContributionState[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Zero-padded sequential ID generator scoped to a prefix. */
function makeIdFactory(prefix: string) {
  let counter = 0;
  return () => `${prefix}${String(++counter).padStart(3, '0')}`;
}

/** Stable Stellar-like public key derived from a seed string. */
function stellarAddress(seed: string): string {
  // Produces a deterministic 56-char G… address for test legibility.
  const padded = seed.toUpperCase().replace(/[^A-Z0-9]/g, 'X').padEnd(54, 'X');
  return `G${padded.slice(0, 54)}`;
}

// ─── GroupFixtureFactory ──────────────────────────────────────────────────────

export const GroupFixtureFactory = {
  // ── Low-level builders ─────────────────────────────────────────────────────

  /**
   * Build a single `Group` object.
   *
   * Defaults represent an active, partially-filled weekly-savings group.
   */
  buildGroup(overrides: Partial<Group> = {}): Group {
    return {
      id: 'grp-001',
      name: 'Test Savers',
      contributionAmount: 100,
      cycleDuration: 604800, // 1 week in seconds
      maxMembers: 5,
      currentMembers: 0,
      status: 'Active',
      tags: ['test'],
      ...overrides,
    };
  },

  /**
   * Build a single `Member` object.
   *
   * @param index  Numeric index used to generate deterministic ids/addresses
   *               when creating many members at once. Defaults to 1.
   */
  buildMember(index = 1, overrides: Partial<Member> = {}): Member {
    const label = `member${index}`;
    return {
      id: `mbr-${String(index).padStart(3, '0')}`,
      address: stellarAddress(label),
      name: `Member ${index}`,
      joinedAt: Date.now() - index * 60_000, // staggered join times
      groupIds: [],
      ...overrides,
    };
  },

  /**
   * Build a contribution `Transaction` for a member in a group.
   */
  buildTransaction(
    groupId: string,
    member: Member,
    txIndex: number,
    overrides: Partial<Transaction> = {}
  ): Transaction {
    return {
      id: `tx-${groupId}-${String(txIndex).padStart(3, '0')}`,
      groupId,
      memberAddress: member.address,
      amount: 100,
      type: 'contribution',
      timestamp: Date.now() - txIndex * 30_000,
      stellarTxHash: `HASH${groupId.toUpperCase()}${String(txIndex).padStart(6, '0')}`,
      ...overrides,
    };
  },

  // ── Composite builders ─────────────────────────────────────────────────────

  /**
   * Build a group with exactly `memberCount` members where **all** members
   * have already contributed in the current cycle (the "fully-contributed"
   * state that triggers a payout).
   *
   * @param memberCount  Number of members to create (1–20).
   * @param groupOverrides  Optional `Group` field overrides.
   */
  buildGroupWithMembers(
    memberCount: number,
    groupOverrides: Partial<Group> = {}
  ): GroupFixture {
    if (memberCount < 1) throw new RangeError('memberCount must be ≥ 1');
    if (memberCount > 20) throw new RangeError('memberCount must be ≤ 20');

    const group = GroupFixtureFactory.buildGroup({
      maxMembers: memberCount,
      currentMembers: memberCount,
      ...groupOverrides,
    });

    const members: Member[] = Array.from({ length: memberCount }, (_, i) =>
      GroupFixtureFactory.buildMember(i + 1, { groupIds: [group.id] })
    );

    const transactions: Transaction[] = members.map((m, i) =>
      GroupFixtureFactory.buildTransaction(group.id, m, i + 1, {
        amount: group.contributionAmount,
      })
    );

    const contributionStates: MemberContributionState[] = members.map((m, i) => ({
      member: m,
      hasContributed: true,
      transaction: transactions[i],
    }));

    return { group, members, transactions, contributionStates };
  },

  /**
   * Build a group where `contributedCount` out of `memberCount` members have
   * contributed. Members are assigned contributed/pending status
   * deterministically: the first `contributedCount` members have paid.
   *
   * This is the primary helper for testing edge cases that depend on partial
   * contribution state (e.g., mid-cycle snapshots, reminder logic).
   *
   * @param memberCount       Total number of members in the group.
   * @param contributedCount  How many have contributed (0 ≤ n ≤ memberCount).
   * @param groupOverrides    Optional `Group` field overrides.
   */
  buildMixedContributionGroup(
    memberCount: number,
    contributedCount: number,
    groupOverrides: Partial<Group> = {}
  ): GroupFixture {
    if (memberCount < 1) throw new RangeError('memberCount must be ≥ 1');
    if (memberCount > 20) throw new RangeError('memberCount must be ≤ 20');
    if (contributedCount < 0 || contributedCount > memberCount) {
      throw new RangeError(
        `contributedCount (${contributedCount}) must be between 0 and memberCount (${memberCount})`
      );
    }

    const group = GroupFixtureFactory.buildGroup({
      maxMembers: memberCount,
      currentMembers: memberCount,
      ...groupOverrides,
    });

    const members: Member[] = Array.from({ length: memberCount }, (_, i) =>
      GroupFixtureFactory.buildMember(i + 1, { groupIds: [group.id] })
    );

    const transactions: Transaction[] = [];
    const contributionStates: MemberContributionState[] = members.map((m, i) => {
      const hasContributed = i < contributedCount;
      if (hasContributed) {
        const tx = GroupFixtureFactory.buildTransaction(group.id, m, transactions.length + 1, {
          amount: group.contributionAmount,
        });
        transactions.push(tx);
        return { member: m, hasContributed: true, transaction: tx };
      }
      return { member: m, hasContributed: false };
    });

    return { group, members, transactions, contributionStates };
  },

  /**
   * Build a group that is exactly **one contribution away** from triggering a
   * payout — all members except the last have paid.
   *
   * Useful for testing payout-trigger logic and cycle-completion events.
   */
  buildNearPayoutGroup(
    memberCount: number,
    groupOverrides: Partial<Group> = {}
  ): GroupFixture {
    if (memberCount < 2) throw new RangeError('memberCount must be ≥ 2 for near-payout state');
    return GroupFixtureFactory.buildMixedContributionGroup(
      memberCount,
      memberCount - 1,
      groupOverrides
    );
  },

  /**
   * Build a group in the `'Completed'` status with all members having
   * received a payout — simulates a fully-cycled group.
   */
  buildCompletedGroup(memberCount: number, groupOverrides: Partial<Group> = {}): GroupFixture {
    if (memberCount < 1) throw new RangeError('memberCount must be ≥ 1');

    const group = GroupFixtureFactory.buildGroup({
      maxMembers: memberCount,
      currentMembers: memberCount,
      status: 'Completed',
      ...groupOverrides,
    });

    const members: Member[] = Array.from({ length: memberCount }, (_, i) =>
      GroupFixtureFactory.buildMember(i + 1, { groupIds: [group.id] })
    );

    // One payout transaction per member (the historical record of the cycle).
    const transactions: Transaction[] = members.map((m, i) =>
      GroupFixtureFactory.buildTransaction(group.id, m, i + 1, {
        type: 'payout',
        amount: group.contributionAmount * memberCount,
      })
    );

    const contributionStates: MemberContributionState[] = members.map((m) => ({
      member: m,
      hasContributed: true,
    }));

    return { group, members, transactions, contributionStates };
  },

  /**
   * Build a group in the `'Paused'` status with some members having
   * contributed before the pause.
   */
  buildPausedGroup(
    memberCount: number,
    contributedCount: number,
    groupOverrides: Partial<Group> = {}
  ): GroupFixture {
    return GroupFixtureFactory.buildMixedContributionGroup(memberCount, contributedCount, {
      status: 'Paused',
      ...groupOverrides,
    });
  },

  /**
   * Build a list of `count` groups with distinct ids and names. Handy for
   * testing list pagination, filtering, or recommendation logic.
   */
  buildGroupList(count: number, groupOverrides: Partial<Group> = {}): Group[] {
    const nextId = makeIdFactory('grp-');
    return Array.from({ length: count }, (_, i) =>
      GroupFixtureFactory.buildGroup({
        id: nextId(),
        name: `Test Group ${i + 1}`,
        currentMembers: i % 3, // varied fill levels: 0, 1, 2, 0, 1, 2, …
        ...groupOverrides,
      })
    );
  },
};
