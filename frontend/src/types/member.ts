// Re-export MemberStatus from the canonical SDK package.
//
// NOTE: The GraphQL API uses a separate Member type — see the generated types
// in `src/generated/graphql.ts` (Member, GetMembersQuery, GetMemberQuery).
// The types below are the frontend UI / REST-layer shapes.
export type { MemberStatus } from '@stellar-save/sdk';

import type { MemberStatus } from '@stellar-save/sdk';

export type MemberSortOption =
  | 'contributions-desc'
  | 'contributions-asc'
  | 'join-date-desc'
  | 'join-date-asc'
  | 'name-asc'
  | 'name-desc'
  | 'payout-position-asc'
  | 'payout-position-desc';

export interface MemberDirectoryFilters {
  search: string;
  status: 'all' | 'active' | 'inactive' | 'pending';
  sort: MemberSortOption;
  hasReceivedPayout: 'all' | 'yes' | 'no';
}

export const DEFAULT_MEMBER_FILTERS: MemberDirectoryFilters = {
  search: '',
  status: 'all',
  sort: 'contributions-desc',
  hasReceivedPayout: 'all',
};

export interface MemberProfile {
  address: string;
  name?: string;
  avatar?: string;
  joinDate: Date;
  contributionCount: number;
  totalContributed: number;
  payoutPosition: number;
  totalMembers: number;
  hasReceivedPayout: boolean;
  status: MemberStatus;
  /** Streak of consecutive on-time contributions */
  streak?: number;
  /** Last contribution timestamp */
  lastContributedAt?: Date;
}
