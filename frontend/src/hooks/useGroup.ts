import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchGroup } from '../utils/groupApi';
import type { GroupDetail, UseGroupReturn } from '../types/group';

// ─── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  data: GroupDetail;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute
const AUTO_REFRESH_MS = 30_000; // poll every 30 s while the hook is mounted
const cache = new Map<string, CacheEntry>();

export function clearGroupCache(): void {
  cache.clear();
}

function getFromCache(id: string): GroupDetail | null {
  const entry = cache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(id);
    return null;
  }
  return entry.data;
}

function setInCache(id: string, data: GroupDetail): void {
  cache.set(id, { data, fetchedAt: Date.now() });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseGroupOptions {
  /** Disable the auto-refresh interval (default: enabled) */
  autoRefresh?: boolean;
  /** Override the auto-refresh interval in ms (default: 30 000) */
  refreshInterval?: number;
}

/**
 * Fetches and manages a single group by ID.
 *
 * Features:
 * - In-memory cache with 1-minute TTL to avoid redundant network calls
 * - Stale-response guard via fetch-ID tracking
 * - Configurable auto-refresh interval (default 30 s)
 * - Manual `refresh()` that busts the cache
 * - Graceful loading / error states
 *
 * @param groupId - The group ID to fetch. Pass `null` / `undefined` to skip fetching.
 */
export function useGroup(
  groupId: string | null | undefined,
  options: UseGroupOptions = {},
): UseGroupReturn {
  const { autoRefresh = true, refreshInterval = AUTO_REFRESH_MS } = options;

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tracks the latest in-flight fetch so stale responses are silently dropped
  const fetchIdRef = useRef(0);

  const load = useCallback(
    async (id: string, bust = false) => {
      const fetchId = ++fetchIdRef.current;

      if (!bust) {
        const cached = getFromCache(id);
        if (cached) {
          setGroup(cached);
          setError(null);
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchGroup(id);

        if (fetchId !== fetchIdRef.current) return; // stale — discard

        if (data === null) {
          setError('Group not found.');
          setGroup(null);
        } else {
          setInCache(id, data);
          setGroup(data);
        }
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return;
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Failed to load group. Please try again.',
        );
      } finally {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  // Initial fetch + re-fetch when groupId changes
  useEffect(() => {
    if (!groupId) {
      setGroup(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    void load(groupId);
  }, [groupId, load]);

  // Auto-refresh on an interval
  useEffect(() => {
    if (!autoRefresh || !groupId) return;

    const id = setInterval(() => {
      void load(groupId, true); // bust cache on each tick
    }, refreshInterval);

    return () => clearInterval(id);
  }, [autoRefresh, groupId, load, refreshInterval]);

  const refresh = useCallback(() => {
    if (groupId) void load(groupId, true);
  }, [groupId, load]);

  return { group, isLoading, error, refresh };
}

// Utilities (for tests/client cache control)
export function clearGroupCache(): void {
  cache.clear();
}
