// Re-export shared primitives from the canonical SDK package so there is a
// single source of truth for these types across frontend, backend, and mobile.
//
// NOTE: The GraphQL API uses separate Group / Member types — see the generated
// types in `src/generated/graphql.ts` (Group, Member, GetGroupQuery, etc.).
// The types below are the REST API / UI-layer shapes used by the frontend.
export type { GroupStatus, PaginationMeta } from '@stellar-save/sdk';

import type { FilterState, SortOption } from '../components/GroupFilters';
import type { GroupStatus, PaginationMeta } from '@stellar-save/sdk';

export interface PublicGroup {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  memberCount: number;
  contributionAmount: number; // in XLM
  currency: string;
  status: GroupStatus;
  createdAt: Date;
  /** Cycle duration in days */
  cycleDuration?: number;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationState {
  page: number;
  pageSize: number;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export type { FilterState, SortOption };

export interface GroupFilters extends FilterState {
  search: string;
  minCycleDuration: string;
  maxCycleDuration: string;
}

export const DEFAULT_GROUP_FILTERS: GroupFilters = {
  search: '',
  status: 'all',
  minAmount: '',
  maxAmount: '',
  minMembers: '',
  maxMembers: '',
  minCycleDuration: '',
  maxCycleDuration: '',
  sort: 'date-desc',
};

// ─── Single Group (detail view) ───────────────────────────────────────────────

export interface GroupDetail extends PublicGroup {
  /** Address of the group creator */
  creator: string;
  /** Cycle duration in seconds */
  cycleDuration: number;
  /** Maximum number of members */
  maxMembers: number;
  /** Minimum members required to activate */
  minMembers: number;
  /** Current cycle index (0-based) */
  currentCycle: number;
  /** Whether the group is currently active */
  isActive: boolean;
  /** Whether the first cycle has been started */
  started: boolean;
  /** Timestamp when the group was activated (0 if not started) */
  startedAt: Date | null;
}

// Note: the `useGroup()` hook's return type (`UseGroupReturn`) lives in
// `hooks/useGroup.ts` since it wraps `DetailedGroup` (members/contributions/
// cycles) from `utils/groupApi`, not the lighter-weight `GroupDetail` above.

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface UseGroupsReturn {
  /** Current page of groups after filtering/sorting */
  groups: PublicGroup[];
  /** All groups matching the current filters (pre-pagination) */
  filteredCount: number;
  /** Pagination metadata */
  pagination: PaginationMeta;
  /** Active filters */
  filters: GroupFilters;
  /** Loading state */
  isLoading: boolean;
  /** Error message, null when no error */
  error: string | null;
  /** Whether any non-default filter is active */
  hasActiveFilters: boolean;
  /** Whether the data is from cache and potentially stale */
  isStale?: boolean;
  /** Whether the data is being served from offline cache */
  fromCache?: boolean;
  /** Update one or more filter fields; resets to page 1 */
  setFilters: (patch: Partial<GroupFilters>) => void;
  /** Reset all filters to defaults */
  clearFilters: () => void;
  /** Navigate to a specific page */
  setPage: (page: number) => void;
  /** Change page size; resets to page 1 */
  setPageSize: (size: number) => void;
  /** Manually re-fetch groups */
  refresh: () => void;
}
