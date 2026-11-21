import { useCallback, useEffect, useState } from 'react';

import {
  defaultLeaderboardSource,
  type LeaderboardSource,
} from '../utils/leaderboardApi';

import type { LeaderboardData, TimePeriod } from '../types/leaderboard';

// ── Cache ─────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: LeaderboardData;
  fetchedAt: number;
}

const CACHE_TTL = 60_000;
const cache = new Map<TimePeriod, CacheEntry>();

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseLeaderboardReturn {
  data: LeaderboardData | null;
  isLoading: boolean;
  error: string | null;
  period: TimePeriod;
  setPeriod: (p: TimePeriod) => void;
  refresh: () => void;
}

/**
 * Fetches leaderboard data for the given period.
 *
 * The data source is injected via `source` — default is `defaultLeaderboardSource`
 * which uses HorizonLeaderboardSource (or MockLeaderboardSource as fallback).
 * Pass a custom source in tests or feature flags:
 *
 * ```tsx
 * const lb = useLeaderboard('month', new MockLeaderboardSource());
 * ```
 */
export function useLeaderboard(
  initial: TimePeriod = 'all-time',
  source: LeaderboardSource = defaultLeaderboardSource,
): UseLeaderboardReturn {
  const [period, setPeriodState] = useState<TimePeriod>(initial);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: TimePeriod, bust = false) => {
      if (!bust) {
        const cached = cache.get(p);
        if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
          setData(cached.data);
          setError(null);
          return;
        }
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await source.fetchLeaderboard(p);
        cache.set(p, { data: result, fetchedAt: Date.now() });
        setData(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load leaderboard.',
        );
      } finally {
        setIsLoading(false);
      }
    },
    [source],
  );

  useEffect(() => {
    void load(period);
  }, [period, load]);

  const setPeriod = useCallback((p: TimePeriod) => setPeriodState(p), []);
  const refresh = useCallback(() => void load(period, true), [period, load]);

  return { data, isLoading, error, period, setPeriod, refresh };
}

export function clearLeaderboardCache(): void {
  cache.clear();
}
