import { useCallback, useState } from 'react';

import { useIsOnline } from './offline';
import { getCachedGroupsListWithStatus, cacheGroupsList } from '../lib/db';
import { fetchGroups } from '../utils/groupApi';

import type { GroupFilters, PublicGroup } from '../types/group';

/**
 * Offline-cache fallback for the group list, kept out of the query hook so the
 * network/cache decision can be tested without React Query or a provider tree.
 */

export interface UseOfflineGroupsCacheReturn {
  /** True when the last resolved list came from IndexedDB rather than the network. */
  fromCache: boolean;
  /** True when the cached list is past its freshness window. */
  isStale: boolean;
  /** Fetch from the network when online, otherwise fall back to the cache. */
  fetchGroupsWithFallback: (filters: GroupFilters) => Promise<PublicGroup[]>;
}

export function useOfflineGroupsCache(): UseOfflineGroupsCacheReturn {
  const isOnline = useIsOnline();
  const [isStale, setIsStale] = useState<boolean>(false);
  const [fromCache, setFromCache] = useState<boolean>(false);

  const fetchGroupsWithFallback = useCallback(
    async (filters: GroupFilters): Promise<PublicGroup[]> => {
      if (isOnline) {
        try {
          const groups = await fetchGroups(filters);
          await cacheGroupsList(groups);
          setIsStale(false);
          setFromCache(false);
          return groups;
        } catch (err) {
          console.warn('[useOfflineGroupsCache] Network fetch failed, falling back to cache', err);
        }
      }

      const cached = await getCachedGroupsListWithStatus();
      if (cached.fromCache) {
        setIsStale(cached.isStale);
        setFromCache(true);
        return cached.groups;
      }

      throw new Error('No data available offline');
    },
    [isOnline]
  );

  return { fromCache, isStale, fetchGroupsWithFallback };
}

export default useOfflineGroupsCache;
