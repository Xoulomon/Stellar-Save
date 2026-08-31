import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

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
 * pattern that used to be hand-rolled (with small inconsistencies) across
 * several hooks in this project — mock-data hooks that simulate latency via
 * `setTimeout`, as well as hooks that call a real async API. It centralizes:
 *
 *  - isLoading / error / data bookkeeping
 *  - guarding against a stale response landing after unmount or after the
 *    inputs have already changed again (no fetchId ref needed at call sites)
 *  - a refetch() that reruns the loader on demand
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
  options: UseAsyncDataOptions = {},
): UseAsyncDataResult<T> {
  const { enabled = true } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Keep the latest loader in a ref so identity churn on the caller's side
  // (e.g. an inline arrow function) doesn't retrigger the effect — only
  // `deps`, `enabled`, and refetch() should do that.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    loaderRef
      .current()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `deps` is caller-controlled, spread intentionally alongside our own
    // enabled/tick triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tick, ...deps]);

  return { data, isLoading, error, refetch };
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
export function useSimulatedLoading(
  ms: number,
  deps: DependencyList = [],
): boolean {
  const { isLoading } = useAsyncData<null>(
    () => mockDelay(() => null, ms),
    deps,
  );
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
