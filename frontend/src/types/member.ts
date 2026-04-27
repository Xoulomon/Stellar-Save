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
  status: 'active' | 'inactive' | 'pending' | 'removed';
  /** Streak of consecutive on-time contributions */
  streak?: number;
  /** Last contribution timestamp */
  lastContributedAt?: Date;
}
