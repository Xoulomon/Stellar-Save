/**
 * Test factories for Member types.
 *
 * Covers both `MemberProfile` (from types/member) and `Member`
 * (the contribution-cycle member from types/contribution).
 */

import type { MemberProfile } from '../../types/member';
import type { Member } from '../../types/contribution';

/**
 * Create a `MemberProfile` fixture with defaults.
 */
export function makeMember(overrides?: Partial<MemberProfile>): MemberProfile {
  return {
    address: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
    name: 'Alice Okonkwo',
    joinDate: new Date('2026-01-10'),
    contributionCount: 6,
    totalContributed: 1500,
    payoutPosition: 1,
    totalMembers: 4,
    hasReceivedPayout: false,
    status: 'active',
    streak: 3,
    ...overrides,
  };
}

/**
 * Create a `Member` (contribution-cycle member) fixture with defaults.
 */
export function makeContributionCycleMember(overrides?: Partial<Member>): Member {
  return {
    address: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
    contributed: false,
    ...overrides,
  };
}
