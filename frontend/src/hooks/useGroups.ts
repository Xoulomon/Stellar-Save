import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchGroups } from '../utils/groupApi';
import type {
  GroupFilters,
  PaginationMeta,
  PublicGroup,
  UseGroupsReturn,
} from '../types/group';
import { DEFAULT_GROUP_FILTERS } from '../types/group';

// ─── Simple in-memory cache ───────────────────────────────────────────────────

interface CacheEntry {
  data: PublicGroup[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute
const cache = new Map<string, CacheEntry>();

function getCacheKey(filters: GroupFilters): string {
  return JSON.stringify(filters);
}

function getFromCache(key: string): PublicGroup[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setInCache(key: string, data: PublicGroup[]): void {
  cache.set(key, { data, fetchedAt: Date.now() });
}

// ─── Filtering helpers ────────────────────────────────────────────────────────

function applyFilters(groups: PublicGroup[], filters: GroupFilters): PublicGroup[] {
  let result = groups;

  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.description?.toLowerCase().includes(q),
    );
  }

  if (filters.status !== 'all') {
    result = result.filter((g) => g.status === filters.status);
  }

  if (filters.minAmount !== '') {
    const min = Number(filters.minAmount);
    result = result.filter((g) => g.contributionAmount >= min);
  }
  if (filters.maxAmount !== '') {
    const max = Number(filters.maxAmount);
    result = result.filter((g) => g.contributionAmount <= max);
  }
  if (filters.minMembers !== '') {
    const min = Number(filters.minMembers);
    result = result.filter((g) => g.memberCount >= min);
  }
  if (filters.maxMembers !== '') {
    const max = Number(filters.maxMembers);
    result = result.filter((g) => g.memberCount <= max);
  }

  return result;
}

function applySort(groups: PublicGroup[], sort: GroupFilters['sort']): PublicGroup[] {
  const sorted = [...groups];
  sorted.sort((a, b) => {
    switch (sort) {
      case 'name-asc':    return a.name.localeCompare(b.name);
      case 'name-desc':   return b.name.localeCompare(a.name);
      case 'amount-asc':  return a.contributionAmount - b.contributionAmount;
      case 'amount-desc': return b.contributionAmount - a.contributionAmount;
      case 'members-asc':  return a.memberCount - b.memberCount;
      case 'members-desc': return b.memberCount - a.memberCount;
      case 'date-asc':  return a.createdAt.getTime() - b.createdAt.getTime();
      case 'date-desc': return b.createdAt.getTime() - a.createdAt.getTime();
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

export function useGroups(options: UseGroupsOptions = {}): UseGroupsReturn {
  const { initialFilters, initialPageSize = 12 } = options;

  const [rawGroups, setRawGroups] = useState<PublicGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<GroupFilters>({
    ...DEFAULT_GROUP_FILTERS,
    ...initialFilters,
  });
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  // Track the latest fetch so stale responses are discarded
  const fetchIdRef = useRef(0);

  const load = useCallback(async (currentFilters: GroupFilters, bust = false) => {
    const fetchId = ++fetchIdRef.current;
    const cacheKey = getCacheKey(currentFilters);

    if (!bust) {
      const cached = getFromCache(cacheKey);
      if (cached) {
        setRawGroups(cached);
        setError(null);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchGroups(currentFilters);

      // Discard if a newer fetch has started
      if (fetchId !== fetchIdRef.current) return;

      setInCache(cacheKey, data);
      setRawGroups(data);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Failed to load groups. Please try again.',
      );
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Re-fetch whenever filters change
  useEffect(() => {
    void load(filters);
  }, [filters, load]);

  // ─── Derived state ──────────────────────────────────────────────────────────

  const filteredAndSorted = useMemo(
    () => applySort(applyFilters(rawGroups, filters), filters.sort),
    [rawGroups, filters],
  );

  const totalItems = filteredAndSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Clamp page to valid range when data changes
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
    filters.maxMembers !== '';

  // ─── Actions ────────────────────────────────────────────────────────────────

  const setFilters = useCallback((patch: Partial<GroupFilters>) => {
    setFiltersState((prev: GroupFilters) => ({ ...prev, ...patch }));
    setPageState(1); // reset to first page on filter change
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_GROUP_FILTERS);
    setPageState(1);
  }, []);

  const setPage = useCallback((next: number) => {
    setPageState(next);
  }, []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size);
    setPageState(1);
  }, []);

  const refresh = useCallback(() => {
    void load(filters, true); // bust cache
  }, [filters, load]);

  return {
    groups: paginatedGroups,
    filteredCount: totalItems,
    pagination,
    filters,
    isLoading,
    error,
    hasActiveFilters,
    setFilters,
    clearFilters,
    setPage,
    setPageSize,
    refresh,
  };
}
