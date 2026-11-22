import { useCallback, useId, useState } from 'react';
import type { DependencyList } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

/**
 * Options for configuring the useAsyncData hook.
 */
export interface UseAsyncDataOptions {
  /**
   * When false, loading is skipped entirely and the hook resets to its
   * empty state (data: null, isLoading: false, error: null). Useful for
   * "nothing to load yet" cases, e.g. no wallet address selected.
   * @default true
   */
  enabled?: boolean;
}

/**
 * Result returned by useAsyncData.
 */
export interface UseAsyncDataResult<T> {
  /** The resolved data, or null before the first successful load. */
  data: T | null;
  /** True while a load is in flight. */
  isLoading: boolean;
  /** Error message from the most recent failed load, or null. */
  error: string | null;
  /** Re-runs the loader, ignoring any previous result. */
  refetch: () => void;
}

/**
 * useAsyncData
 *
 * Canonical hook for the "load one thing into isLoading/error/data state"
 * pattern. Built on React Query's useQuery, with options chosen so behavior
 * matches the previous hand-rolled implementation:
 *
 *  - no retries, no refetch on focus/reconnect, no cross-instance cache
 *  - previous data stays visible while deps change and a reload is in flight
 *  - stale responses are ignored (handled by React Query's query keys)
 *  - refetch() reruns the loader on demand
 *  - an `enabled` escape hatch for "nothing to load yet"
 *
 * `loader` is invoked on mount, whenever an entry in `deps` changes, and
 * whenever `refetch()` is called. It should return a Promise that resolves
 * with the data, or rejects with an Error (or anything `String()`-able)
 * describing the failure.
 *
 * @example
 * ```tsx
 * const { data: transactions, isLoading, error, refetch } = useAsyncData(
 *   () => fetchTransactions(userId),
 *   [userId],
 * );
 * ```
 *
 * @example
 * ```tsx
 * // Skip loading until an address is available
 * const { data: profile, isLoading, error } = useAsyncData(
 *   () => fetchProfile(address as string),
 *   [address],
 *   { enabled: !!address },
 * );
 * ```
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  options: UseAsyncDataOptions = {}
): UseAsyncDataResult<T> {
  const { enabled = true } = options;

  // Unique per hook instance, so two callers with the same deps (e.g. `[]`)
  // never share a cache entry.
  const instanceId = useId();
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  const query = useQuery<T, unknown>({
    queryKey: ['async-data', instanceId, tick, ...deps],
    queryFn: () => loader(),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const errorMessage =
    query.error == null
      ? null
      : query.error instanceof Error
        ? query.error.message
        : String(query.error);

  return {
    data: enabled ? (query.data ?? null) : null,
    isLoading: enabled && query.isFetching,
    error: enabled && !query.isFetching ? errorMessage : null,
    refetch,
  };
}

/**
 * useSimulatedLoading
 *
 * Small helper built on useAsyncData for hooks that expose already-available
 * (often mock/static) data but want to simulate a brief loading state, e.g.
 * to drive a skeleton/spinner in the UI before real API calls replace the
 * mock. Returns only the `isLoading` flag; the data itself is left to the
 * caller since it isn't actually gated behind the delay.
 *
 * @param ms - Milliseconds to simulate loading for.
 * @param deps - Dependencies that should restart the simulated load.
 */
export function useSimulatedLoading(ms: number, deps: DependencyList = []): boolean {
  const { isLoading } = useAsyncData<null>(() => mockDelay(() => null, ms), deps);
  return isLoading;
}

/**
 * mockDelay
 *
 * Wraps a synchronous value factory in a Promise that resolves (or rejects,
 * if the factory throws) after `ms` milliseconds. Used to simulate network
 * latency for hooks that are currently backed by mock data.
 */
export function mockDelay<T>(factory: () => T, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(factory());
      } catch (err) {
        reject(err);
      }
    }, ms);
  });
}

