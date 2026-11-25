import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Options for configuring the useDebounce hook
 */
export interface UseDebounceOptions {
  /**
   * The delay in milliseconds before the debounced value is updated
   * @default 500
   */
  delay?: number;

  /**
   * Whether to update the debounced value immediately on the first call
   * @default false
   */
  leading?: boolean;

  /**
   * Maximum time in milliseconds to wait before forcing an update
   * Useful for ensuring updates happen even with continuous changes
   * @default undefined (no maximum wait)
   */
  maxWait?: number;
}

/**
 * Custom hook that debounces a rapidly changing value
 *
 * This hook delays updating the returned value until after the specified delay
 * has elapsed since the last time the input value changed. This is useful for
 * optimizing performance when dealing with rapidly changing values like search
 * inputs, window resize events, or API calls.
 *
 * @template T - The type of the value being debounced
 * @param value - The value to debounce
 * @param options - Configuration options for debouncing behavior
 * @returns The debounced value
 *
 * @example
 * ```tsx
 * // Basic usage with default 500ms delay
 * const [searchTerm, setSearchTerm] = useState('');
 * const debouncedSearchTerm = useDebounce(searchTerm);
 *
 * useEffect(() => {
 *   // This will only run 500ms after the user stops typing
 *   if (debouncedSearchTerm) {
 *     searchAPI(debouncedSearchTerm);
 *   }
 * }, [debouncedSearchTerm]);
 * ```
 *
 * @example
 * ```tsx
 * // Custom delay and leading edge update
 * const debouncedValue = useDebounce(value, {
 *   delay: 1000,
 *   leading: true,  // Update immediately on first change
 *   maxWait: 3000   // Force update after 3 seconds max
 * });
 * ```
 */
function useDebounceState<T>(
  value: T,
  options: UseDebounceOptions
): { debouncedValue: T; cancel: () => void } {
  const { delay = 500, leading = false, maxWait } = options;
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  const leadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstChangeTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxWaitTimeoutRef.current !== null) {
      clearTimeout(maxWaitTimeoutRef.current);
      maxWaitTimeoutRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    clearTimers();
    if (leadingTimerRef.current !== null) {
      clearTimeout(leadingTimerRef.current);
      leadingTimerRef.current = null;
    }
    firstChangeTimeRef.current = null;
  }, [clearTimers]);

  useEffect(() => {
    clearTimers();

    if (maxWait !== undefined && firstChangeTimeRef.current === null) {
      firstChangeTimeRef.current = Date.now();
    }

    if (leading) {
      leadingTimerRef.current = setTimeout(() => {
        setDebouncedValue(value);
        leadingTimerRef.current = null;
      }, 0);
    }

    if (maxWait !== undefined && firstChangeTimeRef.current !== null) {
      const remaining = maxWait - (Date.now() - firstChangeTimeRef.current);

      if (remaining <= 0) {
        timeoutRef.current = setTimeout(() => {
          setDebouncedValue(value);
          firstChangeTimeRef.current = null;
          timeoutRef.current = null;
        }, 0);
        return clearTimers;
      }

      if (remaining < delay) {
        maxWaitTimeoutRef.current = setTimeout(() => {
          setDebouncedValue(value);
          firstChangeTimeRef.current = null;
          maxWaitTimeoutRef.current = null;
        }, remaining);
      }
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
      firstChangeTimeRef.current = null;
      timeoutRef.current = null;
    }, delay);

    return clearTimers;
  }, [value, delay, leading, maxWait, clearTimers]);

  useEffect(() => cancel, [cancel]);

  return { debouncedValue, cancel };
}

export function useDebounce<T>(value: T, options: UseDebounceOptions = {}): T {
  return useDebounceState(value, options).debouncedValue;
}

export function useDebounceWithCancel<T>(
  value: T,
  options: UseDebounceOptions = {}
): { debouncedValue: T; cancel: () => void } {
  return useDebounceState(value, options);
}

export default useDebounce;
