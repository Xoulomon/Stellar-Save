import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchGroups } from '../utils/groupApi';
import { queryKeys } from '../lib/queryKeys';
import { STALE_TIME } from '../lib/queryClient';
import type {
  GroupFilters,
  PaginationMeta,
  PublicGroup,
  UseGroupsReturn,
} from '../types/group';
import { DEFAULT_GROUP_FILTERS } from '../types/group';
import {
  getCachedGroupsListWithStatus,
  cacheGroupsList,
} from '../lib/db';
import { useIsOnline } from './useOfflineSync';

// ─── Filtering / sorting helpers ──────────────────────────────────────────────

function applyFilters(groups: PublicGroup[], filters: GroupFilters): PublicGroup[] {
  let result = groups;

  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (g) => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
    );
  }
  if (filters.status !== 'all') result = result.filter((g) => g.status === filters.status);
  if (filters.minAmount !== '') result = result.filter((g) => g.contributionAmount >= Number(filters.minAmount));
  if (filters.maxAmount !== '') result = result.filter((g) => g.contributionAmount <= Number(filters.maxAmount));
  if (filters.minMembers !== '') result = result.filter((g) => g.memberCount >= Number(filters.minMembers));
  if (filters.maxMembers !== '') result = result.filter((g) => g.memberCount <= Number(filters.maxMembers));

  return result;
}

function applySort(groups: PublicGroup[], sort: GroupFilters['sort']): PublicGroup[] {
  const sorted = [...groups];
  sorted.sort((a, b) => {
    switch (sort) {
      case 'name-asc':     return a.name.localeCompare(b.name);
      case 'name-desc':    return b.name.localeCompare(a.name);
      case 'amount-asc':   return a.contributionAmount - b.contributionAmount;
      case 'amount-desc':  return b.contributionAmount - a.contributionAmount;
      case 'members-asc':  return a.memberCount - b.memberCount;
      case 'members-desc': return b.memberCount - a.memberCount;
      case 'date-asc':     return a.createdAt.getTime() - b.createdAt.getTime();
      case 'date-desc':    return b.createdAt.getTime() - a.createdAt.getTime();
      default: return 0;
    }
  });
  return sorted;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseGroupsOptions {
  initialFilters?: Partial<GroupFilters>;
  initialPageSize?: number;
}

/**
 * Fetches and manages the group list with filtering, sorting, and pagination.
 *
 * staleTime: 30_000 — group list changes infrequently; avoids redundant RPC
 * calls while browsing/filtering.
 * 
 * Offline-first: Falls back to cached data when offline, shows stale indicator
 */
export function useGroups(options: UseGroupsOptions = {}): UseGroupsReturn {
  const { initialFilters, initialPageSize = 12 } = options;
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();

  const [filters, setFiltersState] = useState<GroupFilters>({
    ...DEFAULT_GROUP_FILTERS,
    ...initialFilters,
  });
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [isStale, setIsStale] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const { data: rawGroups = [], isLoading, error } = useQuery<PublicGroup[], Error>({
    queryKey: queryKeys.groups.list(filters),
    queryFn: async () => {
      // Try to fetch from network
      if (isOnline) {
        try {
          const groups = await fetchGroups(filters);
          // Cache the result
          await cacheGroupsList(groups);
          setIsStale(false);
          setFromCache(false);
          return groups;
        } catch (err) {
          console.warn('[useGroups] Network fetch failed, falling back to cache', err);
        }
      }

      // Fall back to cached data
      const cached = await getCachedGroupsListWithStatus();
      if (cached.fromCache) {
        setIsStale(cached.isStale);
        setFromCache(true);
        return cached.groups;
      }

      throw new Error('No data available offline');
    },
    staleTime: STALE_TIME.GROUP_STATE,
    retry: false,
  });

  // ─── Derived state ──────────────────────────────────────────────────────────

  const filteredAndSorted = useMemo(
    () => applySort(applyFilters(rawGroups, filters), filters.sort),
    [rawGroups, filters]
  );

  const totalItems = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginatedGroups = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, safePage, pageSize]);

  const pagination: PaginationMeta = {
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.minAmount !== '' ||
    filters.maxAmount !== '' ||
    filters.minMembers !== '' ||
    filters.maxMembers !== '' ||
    filters.minCycleDuration !== '' ||
    filters.maxCycleDuration !== '';

  // ─── Actions ────────────────────────────────────────────────────────────────

  const setFilters = useCallback((patch: Partial<GroupFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
    setPageState(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_GROUP_FILTERS);
    setPageState(1);
  }, []);

  const setPage = useCallback((next: number) => setPageState(next), []);
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageState(1);
  }, []);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.groups.all() });
  }, [queryClient]);

  return {
    groups: paginatedGroups,
    filteredCount: totalItems,
    pagination,
    filters,
    isLoading,
    error: error?.message ?? null,
    hasActiveFilters,
    isStale,
    fromCache,
    setFilters,
    clearFilters,
    setPage,
    setPageSize,
    refresh,
  };
}

// Keep backward-compat export for tests
export function clearGroupsCache() {
  // no-op — React Query manages its own cache
}
