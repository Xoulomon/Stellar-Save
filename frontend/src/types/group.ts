import type { FilterState, SortOption } from '../components/GroupFilters';

export type GroupStatus = 'active' | 'completed' | 'pending';

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
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export type { FilterState, SortOption };

export interface GroupFilters extends FilterState {
  search: string;
}

export const DEFAULT_GROUP_FILTERS: GroupFilters = {
  search: '',
  status: 'all',
  minAmount: '',
  maxAmount: '',
  minMembers: '',
  maxMembers: '',
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

// ─── useGroup return type ─────────────────────────────────────────────────────

export interface UseGroupReturn {
  /** Full group detail, null while loading or on error */
  group: GroupDetail | null;
  /** True during the initial fetch or a manual refresh */
  isLoading: boolean;
  /** Error message, null when no error */
  error: string | null;
  /** Manually re-fetch (busts cache) */
  refresh: () => void;
}

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
