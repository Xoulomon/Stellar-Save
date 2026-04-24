/**
 * useActivityFeed.ts
 *
 * Hook for the real-time activity feed.
 *
 * Features:
 * - Loads the initial page of historical events on mount.
 * - Supports infinite scroll: call `loadMore()` to append older events.
 * - Subscribes to live events via EventService and prepends them.
 * - Supports filtering by event type and group ID.
 * - Deduplicates events by a stable key derived from type + timestamp + actor.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { EventService } from '../lib/EventService';
import type { AppEvent, EventType } from '../types/events';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityItem {
  /** Stable dedup key */
  id: string;
  event: AppEvent;
  /** Milliseconds since epoch, derived from the on-chain timestamp */
  timestampMs: number;
}

export interface ActivityFeedFilter {
  types?: EventType[];
  groupId?: bigint;
}

export interface UseActivityFeedOptions {
  filter?: ActivityFeedFilter;
  /** How many items to load per page (default: 20) */
  pageSize?: number;
  /** Whether to subscribe to live events (default: true) */
  liveUpdates?: boolean;
}

export interface UseActivityFeedReturn {
  items: ActivityItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  /** Load the next page of older events */
  loadMore: () => void;
  /** Refresh from scratch */
  refresh: () => void;
  /** Update the active filter */
  setFilter: (filter: ActivityFeedFilter) => void;
  activeFilter: ActivityFeedFilter;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a millisecond timestamp from any AppEvent */
function getTimestampMs(event: AppEvent): number {
  switch (event.type) {
    case 'GroupCreated':
      return Number(event.createdAt) * 1000;
    case 'MemberJoined':
      return Number(event.joinedAt) * 1000;
    case 'ContributionMade':
      return Number(event.contributedAt) * 1000;
    case 'PayoutExecuted':
      return Number(event.executedAt) * 1000;
    default:
      return Date.now();
  }
}

/** Derive a stable dedup key from an event */
function eventKey(event: AppEvent): string {
  const ts = getTimestampMs(event);
  switch (event.type) {
    case 'GroupCreated':
      return `GroupCreated-${event.groupId}-${ts}`;
    case 'MemberJoined':
      return `MemberJoined-${event.groupId}-${event.member}-${ts}`;
    case 'ContributionMade':
      return `ContributionMade-${event.groupId}-${event.contributor}-${event.cycle}-${ts}`;
    case 'PayoutExecuted':
      return `PayoutExecuted-${event.groupId}-${event.recipient}-${event.cycle}-${ts}`;
    default:
      return `unknown-${ts}-${Math.random()}`;
  }
}

function toActivityItem(event: AppEvent): ActivityItem {
  return {
    id: eventKey(event),
    event,
    timestampMs: getTimestampMs(event),
  };
}

function matchesFilter(event: AppEvent, filter: ActivityFeedFilter): boolean {
  if (filter.types && filter.types.length > 0) {
    if (!filter.types.includes(event.type)) return false;
  }
  if (filter.groupId !== undefined) {
    const ev = event as Record<string, unknown>;
    if (ev['groupId'] !== filter.groupId) return false;
  }
  return true;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useActivityFeed(
  options: UseActivityFeedOptions = {},
): UseActivityFeedReturn {
  const { pageSize = 20, liveUpdates = true } = options;

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilterState] = useState<ActivityFeedFilter>(
    options.filter ?? {},
  );

  // Cursor for the next "load more" page
  const nextCursorRef = useRef<string | null>(null);
  // Track seen IDs to deduplicate live events
  const seenIdsRef = useRef<Set<string>>(new Set());
  // Abort stale fetches
  const fetchIdRef = useRef(0);

  const service = EventService.getInstance();

  // ── Initial / refresh load ─────────────────────────────────────────────────

  const load = useCallback(
    async (filter: ActivityFeedFilter, bust = false) => {
      const fetchId = ++fetchIdRef.current;

      setIsLoading(true);
      setError(null);

      if (bust) {
        seenIdsRef.current = new Set();
        nextCursorRef.current = null;
      }

      try {
        const result = await service.fetchEvents({
          groupId: filter.groupId,
          types: filter.types,
          limit: pageSize,
        });

        if (fetchId !== fetchIdRef.current) return;

        const newItems = result.events
          .filter((e) => matchesFilter(e, filter))
          .map(toActivityItem)
          .filter((item) => {
            if (seenIdsRef.current.has(item.id)) return false;
            seenIdsRef.current.add(item.id);
            return true;
          })
          .sort((a, b) => b.timestampMs - a.timestampMs);

        nextCursorRef.current = result.nextCursor;
        setItems(newItems);
        setHasMore(result.hasMore);
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return;
        setError(
          err instanceof Error ? err.message : 'Failed to load activity feed.',
        );
      } finally {
        if (fetchId === fetchIdRef.current) setIsLoading(false);
      }
    },
    [service, pageSize],
  );

  // ── Load more (infinite scroll) ────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      const result = await service.fetchEvents({
        groupId: activeFilter.groupId,
        types: activeFilter.types,
        cursor: nextCursorRef.current ?? undefined,
        limit: pageSize,
      });

      const newItems = result.events
        .filter((e) => matchesFilter(e, activeFilter))
        .map(toActivityItem)
        .filter((item) => {
          if (seenIdsRef.current.has(item.id)) return false;
          seenIdsRef.current.add(item.id);
          return true;
        })
        .sort((a, b) => b.timestampMs - a.timestampMs);

      nextCursorRef.current = result.nextCursor;
      setItems((prev) =>
        [...prev, ...newItems].sort((a, b) => b.timestampMs - a.timestampMs),
      );
      setHasMore(result.hasMore);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load more activity.',
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, service, activeFilter, pageSize]);

  // ── Live subscription ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!liveUpdates) return;

    const unsubscribe = service.on('all', (event) => {
      if (!matchesFilter(event, activeFilter)) return;

      const item = toActivityItem(event);
      if (seenIdsRef.current.has(item.id)) return;
      seenIdsRef.current.add(item.id);

      setItems((prev) => [item, ...prev]);
    });

    service.startWatching().catch(console.error);

    return () => {
      unsubscribe();
    };
  }, [service, liveUpdates, activeFilter]);

  // ── Initial load ───────────────────────────────────────────────────────────

  useEffect(() => {
    void load(activeFilter, true);
  }, [load, activeFilter]);

  // ── Public API ─────────────────────────────────────────────────────────────

  const refresh = useCallback(() => {
    void load(activeFilter, true);
  }, [load, activeFilter]);

  const setFilter = useCallback((filter: ActivityFeedFilter) => {
    setActiveFilterState(filter);
  }, []);

  return {
    items,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    setFilter,
    activeFilter,
  };
}
