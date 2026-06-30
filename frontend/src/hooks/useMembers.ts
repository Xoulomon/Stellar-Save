import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchGroup } from '../utils/groupApi';
import type { GroupMember } from '../utils/groupApi';

interface CacheEntry {
  members: GroupMember[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute
const AUTO_REFRESH_MS = 30_000; // 30 seconds
const cache = new Map<string, CacheEntry>();

function getFromCache(groupId: string): GroupMember[] | null {
  const entry = cache.get(groupId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(groupId);
    return null;
  }
  return entry.members;
}

function setInCache(groupId: string, members: GroupMember[]): void {
  cache.set(groupId, {
    members,
    fetchedAt: Date.now(),
  });
}

export interface UseMembersOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface UseMembersReturn {
  members: GroupMember[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useMembers(
  groupId: string | null | undefined,
  options: UseMembersOptions = {},
): UseMembersReturn {
  const { autoRefresh = true, refreshInterval = AUTO_REFRESH_MS } = options;

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIdRef = useRef(0);

  const load = useCallback(
    async (id: string, bust = false) => {
      const fetchId = ++fetchIdRef.current;

      if (!bust) {
        const cached = getFromCache(id);
        if (cached) {
          setMembers(cached);
          setError(null);
          return;
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const group = await fetchGroup(id);

        if (fetchId !== fetchIdRef.current) return;

        if (!group) {
          setMembers([]);
          setError('Group not found.');
        } else {
          const memberList = group.members ?? [];
          setInCache(id, memberList);
          setMembers(memberList);
          setError(null);
        }
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return;

        setMembers([]);
        setError(
          err instanceof Error && err.message
            ? err.message
            : 'Failed to load members. Please try again.',
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
      setMembers([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    void load(groupId);
  }, [groupId, load]);

  useEffect(() => {
    if (!autoRefresh || !groupId) return;

    const intervalId = setInterval(() => {
      void load(groupId, true);
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [autoRefresh, groupId, load, refreshInterval]);

  const refresh = useCallback(() => {
    if (groupId) void load(groupId, true);
  }, [groupId, load]);

  return {
    members,
    isLoading,
    error,
    refresh,
  };
}

// Test helper
export function clearMembersCache(): void {
  cache.clear();
}
