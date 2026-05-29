import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchGroups } from '../utils/groupApi';
import type { GroupFilters, PublicGroup, UseGroupsReturn } from '../types/group';
import { DEFAULT_GROUP_FILTERS } from '../types/group';

interface UseDiscoveryFeedOptions {
  initialFilters?: Partial<GroupFilters>;
  initialPageSize?: number;
}

interface UseDiscoveryFeedReturn {
  recommendations: PublicGroup[];
  filters: GroupFilters;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  visibleCount: number;
  totalCount: number;
  setFilters: (patch: Partial<GroupFilters>) => void;
  clearFilters: () => void;
  refresh: () => void;
  loadMore: () => void;
}

function normalizeNumberInput(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesGroupFilters(group: PublicGroup, filters: GroupFilters): boolean {
  const search = filters.search.trim().toLowerCase();
  if (search) {
    const value = `${group.name} ${group.description ?? ''}`.toLowerCase();
    if (!value.includes(search)) {
      return false;
    }
  }

  if (filters.status !== 'all' && group.status !== filters.status) {
    return false;
  }

  const minAmount = normalizeNumberInput(filters.minAmount);
  const maxAmount = normalizeNumberInput(filters.maxAmount);
  const minMembers = normalizeNumberInput(filters.minMembers);
  const maxMembers = normalizeNumberInput(filters.maxMembers);

  if (minAmount !== null && group.contributionAmount < minAmount) return false;
  if (maxAmount !== null && group.contributionAmount > maxAmount) return false;
  if (minMembers !== null && group.memberCount < minMembers) return false;
  if (maxMembers !== null && group.memberCount > maxMembers) return false;

  return true;
}

function scoreGroupForDiscovery(group: PublicGroup, filters: GroupFilters): number {
  let score = 0;
  const search = filters.search.trim().toLowerCase();

  if (search) {
    const lowerName = group.name.toLowerCase();
    const lowerDescription = group.description?.toLowerCase() ?? '';
    if (lowerName.includes(search)) score += 35;
    if (lowerDescription.includes(search)) score += 20;
    if (lowerName.startsWith(search)) score += 10;
    if (lowerDescription.startsWith(search)) score += 5;
  }

  if (filters.status !== 'all') {
    score += group.status === filters.status ? 25 : -20;
  }

  const minAmount = normalizeNumberInput(filters.minAmount);
  const maxAmount = normalizeNumberInput(filters.maxAmount);
  if (minAmount !== null) score += group.contributionAmount >= minAmount ? 8 : -8;
  if (maxAmount !== null) score += group.contributionAmount <= maxAmount ? 6 : -6;

  const minMembers = normalizeNumberInput(filters.minMembers);
  const maxMembers = normalizeNumberInput(filters.maxMembers);
  if (minMembers !== null) score += group.memberCount >= minMembers ? 8 : -8;
  if (maxMembers !== null) score += group.memberCount <= maxMembers ? 6 : -6;

  score += Math.min(group.memberCount, 20);
  if (group.status === 'active') score += 10;

  const ageDays = Math.max(0, (Date.now() - group.createdAt.getTime()) / 86_400_000);
  score += Math.max(0, 16 - ageDays / 7);

  return score;
}

function recommendGroups(groups: PublicGroup[], filters: GroupFilters): PublicGroup[] {
  return groups
    .filter((group) => matchesGroupFilters(group, filters))
    .map((group) => ({ group, score: scoreGroupForDiscovery(group, filters) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.group.createdAt.getTime() - a.group.createdAt.getTime();
    })
    .map((entry) => entry.group);
}

export function useDiscoveryFeed(options: UseDiscoveryFeedOptions = {}): UseDiscoveryFeedReturn {
  const { initialFilters, initialPageSize = 8 } = options;
  const [rawGroups, setRawGroups] = useState<PublicGroup[]>([]);
  const [filters, setFiltersState] = useState<GroupFilters>({
    ...DEFAULT_GROUP_FILTERS,
    ...initialFilters,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(initialPageSize);

  const fetchIdRef = useRef(0);

  const loadGroups = useCallback(async (bust = false) => {
    const fetchId = ++fetchIdRef.current;
    setError(null);
    setIsLoading(true);

    try {
      const groups = await fetchGroups();
      if (fetchId !== fetchIdRef.current) return;
      setRawGroups(groups);
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Failed to load group recommendations. Please try again.',
      );
    } finally {
      if (fetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const recommendations = useMemo(
    () => recommendGroups(rawGroups, filters),
    [rawGroups, filters],
  );

  const totalCount = recommendations.length;
  const hasMore = visibleCount < totalCount;
  const visibleRecommendations = useMemo(
    () => recommendations.slice(0, visibleCount),
    [recommendations, visibleCount],
  );

  useEffect(() => {
    setVisibleCount(initialPageSize);
  }, [filters, initialPageSize]);

  const setFilters = useCallback((patch: Partial<GroupFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_GROUP_FILTERS);
  }, []);

  const refresh = useCallback(() => {
    void loadGroups(true);
  }, [loadGroups]);

  const loadMore = useCallback(() => {
    setVisibleCount((current) => Math.min(current + initialPageSize, totalCount));
  }, [initialPageSize, totalCount]);

  return {
    recommendations: visibleRecommendations,
    filters,
    isLoading,
    error,
    hasMore,
    visibleCount,
    totalCount,
    setFilters,
    clearFilters,
    refresh,
    loadMore,
  };
}
