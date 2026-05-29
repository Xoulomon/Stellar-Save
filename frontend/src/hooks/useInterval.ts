import { useEffect, useRef } from 'react';

/**
 * useInterval
 *
 * Runs `callback` every `delay` milliseconds.
 * Pass `null` as delay to pause the interval.
 * The callback ref is kept up-to-date so stale closures are never an issue.
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef<() => void>(callback);

  // Keep the ref current on every render
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
