import { QueryClient } from '@tanstack/react-query';

/**
 * Stale-time constants.
 *
 * GROUP_STATE  – group config/metadata changes infrequently (member count,
 *                status, contribution amount). 30 s stale-time avoids
 *                redundant RPC calls while keeping data reasonably fresh.
 *
 * CONTRIBUTION_STATUS – whether a member has contributed this cycle must
 *                       always be fresh (staleTime: 0 triggers a background
 *                       refetch on every mount/focus).
 */
export const STALE_TIME = {
  GROUP_STATE: 30_000,       // 30 seconds — group state queries
  CONTRIBUTION_STATUS: 0,    // always fresh — contribution status queries
} as const;

/** How long unused query data stays in the cache before being garbage-collected. */
export const GC_TIME = {
  DEFAULT: 5 * 60_000,       // 5 minutes
} as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Sensible global defaults — individual queries override as needed.
      staleTime: STALE_TIME.GROUP_STATE,
      gcTime: GC_TIME.DEFAULT,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
