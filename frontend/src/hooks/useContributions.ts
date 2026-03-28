import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchGroup } from '../utils/groupApi';
import type { GroupContribution, GroupCycle } from '../utils/groupApi';

interface CacheEntry {
  contributions: GroupContribution[];
  currentCycle: GroupCycle | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute
const AUTO_REFRESH_MS = 30_000; // default auto-refresh
const cache = new Map<string, CacheEntry>();

function getFromCache(groupId: string): CacheEntry | null {
  const entry = cache.get(groupId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(groupId);
    return null;
  }
  return entry;
}

function setInCache(groupId: string, contributions: GroupContribution[], currentCycle: GroupCycle | null) {
  cache.set(groupId, {
    contributions,
    currentCycle,
    fetchedAt: Date.now(),
  });
}

export interface ContributionStatusSummary {
  totalContributions: number;
  completedCount: number;
  pendingCount: number;
  failedCount: number;
  totalAmount: number;
  lastContributionDate: Date | null;
}

export interface UseContributionsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseContributionsReturn {
  contributions: GroupContribution[];
  currentCycle: GroupCycle | null;
  status: ContributionStatusSummary;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useContributions(
  groupId: string | null | undefined,
  options: UseContributionsOptions = {},
): UseContributionsReturn {
  const { autoRefresh = true, refreshInterval = AUTO_REFRESH_MS } = options;

  const [contributions, setContributions] = useState<GroupContribution[]>([]);
  const [currentCycle, setCurrentCycle] = useState<GroupCycle | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIdRef = useRef(0);

  const load = useCallback(
    async (id: string, bust = false) => {
      const fetchId = ++fetchIdRef.current;

      if (!bust) {
        const cached = getFromCache(id);
        if (cached) {
          setContributions(cached.contributions);
          setCurrentCycle(cached.currentCycle);
          setError(null);
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchGroup(id);

        if (fetchId !== fetchIdRef.current) return;

        if (!data) {
          setContributions([]);
          setCurrentCycle(null);
          setError('Group not found.');
        } else {
          const contributionsData = data.contributions ?? [];
          const currentCycleData = data.currentCycle ?? null;
          setInCache(id, contributionsData, currentCycleData);
          setContributions(contributionsData);
          setCurrentCycle(currentCycleData);
        }
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return;

        setContributions([]);
        setCurrentCycle(null);
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Failed to load contributions. Please try again.',
        );
      } finally {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!groupId) {
      setContributions([]);
      setCurrentCycle(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    void load(groupId);
  }, [groupId, load]);

  useEffect(() => {
    if (!autoRefresh || !groupId) return;

    const id = setInterval(() => {
      void load(groupId, true);
    }, refreshInterval);

    return () => clearInterval(id);
  }, [autoRefresh, groupId, load, refreshInterval]);

  const refresh = useCallback(() => {
    if (groupId) void load(groupId, true);
  }, [groupId, load]);

  const status = useMemo<ContributionStatusSummary>(() => {
    const totalContributions = contributions.length;
    const completedCount = contributions.filter((c) => c.status === 'completed').length;
    const pendingCount = contributions.filter((c) => c.status === 'pending').length;
    const failedCount = contributions.filter((c) => c.status === 'failed').length;
    const totalAmount = contributions.reduce((sum, c) => sum + (c.amount ?? 0), 0);

    const lastContributionDate = contributions
      .map((c) => c.timestamp)
      .filter((d): d is Date => d !== undefined && d !== null)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    return {
      totalContributions,
      completedCount,
      pendingCount,
      failedCount,
      totalAmount,
      lastContributionDate,
    };
  }, [contributions]);

  return {
    contributions,
    currentCycle,
    status,
    isLoading,
    error,
    refresh,
  };
}

// Utilities (for tests/client cache control)
export function clearContributionsCache(): void {
  cache.clear();
}
