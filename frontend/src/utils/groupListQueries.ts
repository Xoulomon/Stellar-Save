import { applyGroupFilters } from '../lib/filters';

export type SortField = 'name' | 'memberCount' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

export interface GroupFilterParams {
  searchQuery?: string;
  currencyFilter?: string;
  minAmount?: string;
  maxAmount?: string;
}

export interface GroupLike {
  name: string;
  description?: string;
  memberCount?: number;
  contributionAmount?: number;
  currency?: string;
  createdAt?: Date;
  [key: string]: unknown;
}

export function filterGroups<G extends GroupLike>(groups: G[], params: GroupFilterParams): G[] {
  return applyGroupFilters(groups, params);
}

export function sortGroups<G extends GroupLike>(groups: G[], config: SortConfig): G[] {
  const sorted = [...groups];
  const direction = config.order === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    const rawA = a[config.field];
    const rawB = b[config.field];

    if (rawA === undefined) return 1;
    if (rawB === undefined) return -1;

    const aValue = rawA instanceof Date ? rawA.getTime() : rawA;
    const bValue = rawB instanceof Date ? rawB.getTime() : rawB;

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return (aValue - bValue) * direction;
    }

    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();

    if (aStr < bStr) return -1 * direction;
    if (aStr > bStr) return 1 * direction;
    return 0;
  });

  return sorted;
}

export function groupByStatus<G extends GroupLike & { status?: string }>(groups: G[]): Record<string, G[]> {
  return groups.reduce<Record<string, G[]>>((acc, group) => {
    const key = group.status ?? 'unknown';
    (acc[key] ??= []).push(group);
    return acc;
  }, {});
}

export function paginateGroups<G>(groups: G[], page: number, pageSize: number, enabled = true): G[] {
  if (!enabled) return groups;
  const startIndex = (page - 1) * pageSize;
  return groups.slice(startIndex, startIndex + pageSize);
}

export interface GroupQueryResult<G> {
  items: G[];
  totalCount: number;
  totalPages: number;
}

export function queryGroups<G extends GroupLike>(
  groups: G[],
  params: GroupFilterParams & {
    sort: SortConfig;
    page: number;
    pageSize: number;
    paginate?: boolean;
  },
): GroupQueryResult<G> {
  const filtered = filterGroups(groups, params);
  const sorted = sortGroups(filtered, params.sort);
  const items = paginateGroups(sorted, params.page, params.pageSize, params.paginate !== false);
  return {
    items,
    totalCount: sorted.length,
    totalPages: Math.ceil(sorted.length / params.pageSize),
  };
}
