import type { ApiMember, GroupMemberLike, MemberProfileLike } from './types';

let apiMemberCounter = 0;

/** Backend-shaped member (matches backend/src/mock_data.ts mockMembers exactly). */
export function buildApiMember(overrides: Partial<ApiMember> = {}): ApiMember {
  apiMemberCounter += 1;
  return {
    id: `m${apiMemberCounter}`,
    name: `Test Member ${apiMemberCounter}`,
    address: `G...TEST${apiMemberCounter}`,
    joinedAt: Date.now(),
    groupIds: ['1'],
    ...overrides,
  };
}

/**
 * Canonical set of backend members. Values intentionally match
 * backend/src/mock_data.ts's mockMembers so the two stay identical; the
 * contract test asserts this on every run.
 */
export const mockApiMembers: ApiMember[] = [
  { id: 'm1', name: 'Alice Johnson', address: 'G...ALICE', joinedAt: Date.now(), groupIds: ['1', '2'] },
  { id: 'm2', name: 'Bob Smith', address: 'G...BOB', joinedAt: Date.now(), groupIds: ['1'] },
  { id: 'm3', name: 'Charlie Davis', address: 'G...CHARLIE', joinedAt: Date.now(), groupIds: ['3'] },
];

let groupMemberCounter = 0;

/** Frontend view-model member (matches sdk GroupMember used by group detail/member panels). */
export function buildGroupMember(overrides: Partial<GroupMemberLike> = {}): GroupMemberLike {
  groupMemberCounter += 1;
  return {
    id: `m${groupMemberCounter}`,
    address: `GABCDEFGHIJKLMNOPQRSTUVWXYZ${String(groupMemberCounter).padStart(6, '0')}`,
    name: `Test Member ${groupMemberCounter}`,
    joinedAt: new Date('2024-01-01'),
    totalContributions: 500,
    isActive: true,
    ...overrides,
  };
}

/** Frontend view-model member profile (matches frontend/src/types/member.ts MemberProfile). */
export function buildMemberProfile(overrides: Partial<MemberProfileLike> = {}): MemberProfileLike {
  return {
    address: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
    name: 'Test Member',
    joinDate: new Date('2026-01-01'),
    contributionCount: 1,
    totalContributed: 250,
    payoutPosition: 1,
    totalMembers: 1,
    hasReceivedPayout: false,
    status: 'active',
    ...overrides,
  };
}
