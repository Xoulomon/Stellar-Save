import { useEffect, useRef, useState } from 'react';

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
export function useDebounce<T>(
  value: T,
  options: UseDebounceOptions = {}
): T {
  const { delay = 500, leading = false, maxWait } = options;

  // State to store the debounced value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  // Use refs to track state without causing re-renders
  const isFirstUpdate = useRef<boolean>(true);
  const firstChangeTimeRef = useRef<number | null>(null);
  const maxWaitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Handle leading edge update (immediate update on first change)
    if (leading && isFirstUpdate.current) {
      isFirstUpdate.current = false;
      if (maxWait !== undefined) {
        firstChangeTimeRef.current = Date.now();
      }
      // Use setTimeout to avoid synchronous setState in effect
      const leadingHandler = setTimeout(() => {
        setDebouncedValue(value);
      }, 0);
      return () => clearTimeout(leadingHandler);
    }

    // Initialize first change time for maxWait tracking
    if (maxWait !== undefined && firstChangeTimeRef.current === null) {
      firstChangeTimeRef.current = Date.now();
    }

    // Check if maxWait has been exceeded
    if (maxWait !== undefined && firstChangeTimeRef.current !== null) {
      const elapsed = Date.now() - firstChangeTimeRef.current;
      const remaining = maxWait - elapsed;

      if (remaining <= 0) {
        // Max wait time exceeded, update immediately
        const immediateHandler = setTimeout(() => {
          setDebouncedValue(value);
          firstChangeTimeRef.current = null;
        }, 0);
        return () => clearTimeout(immediateHandler);
      } else if (remaining < delay) {
        // Max wait will be reached before normal delay
        maxWaitTimeoutRef.current = setTimeout(() => {
          setDebouncedValue(value);
          firstChangeTimeRef.current = null;
        }, remaining);
      }
    }

    // Set up the debounce timer
    const handler = setTimeout(() => {
      setDebouncedValue(value);
      firstChangeTimeRef.current = null; // Reset first change time after update
    }, delay);

    // Cleanup function to cancel the timeout if value changes again
    // or component unmounts before the delay has elapsed
    return () => {
      clearTimeout(handler);
      if (maxWaitTimeoutRef.current) {
        clearTimeout(maxWaitTimeoutRef.current);
        maxWaitTimeoutRef.current = null;
      }
    };
  }, [value, delay, leading, maxWait]);

  return debouncedValue;
}

/**
 * Alternative hook that returns both the debounced value and a cancel function
 * 
 * @template T - The type of the value being debounced
 * @param value - The value to debounce
 * @param options - Configuration options for debouncing behavior
 * @returns Object containing the debounced value and a cancel function
 * 
 * @example
 * ```tsx
 * const { debouncedValue, cancel } = useDebounceWithCancel(searchTerm, {
 *   delay: 1000
 * });
 * 
 * // Cancel pending debounce on unmount or user action
 * useEffect(() => {
 *   return () => cancel();
 * }, [cancel]);
 * ```
 */
export function useDebounceWithCancel<T>(
  value: T,
  options: UseDebounceOptions = {}
): { debouncedValue: T; cancel: () => void } {
  const { delay = 500, leading = false, maxWait } = options;
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  
  // Use refs to track state and timeouts
  const isFirstUpdate = useRef<boolean>(true);
  const firstChangeTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxWaitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cancel function to clear pending debounce
  const cancel = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (maxWaitTimeoutRef.current) {
      clearTimeout(maxWaitTimeoutRef.current);
      maxWaitTimeoutRef.current = null;
    }
    firstChangeTimeRef.current = null;
  };

  useEffect(() => {
    // Handle leading edge update
    if (leading && isFirstUpdate.current) {
      isFirstUpdate.current = false;
      if (maxWait !== undefined) {
        firstChangeTimeRef.current = Date.now();
      }
      // Use setTimeout to avoid synchronous setState in effect
      const leadingHandler = setTimeout(() => {
        setDebouncedValue(value);
      }, 0);
      timeoutRef.current = leadingHandler;
      return () => clearTimeout(leadingHandler);
    }

    // Initialize first change time for maxWait tracking
    if (maxWait !== undefined && firstChangeTimeRef.current === null) {
      firstChangeTimeRef.current = Date.now();
    }

    // Check if maxWait has been exceeded
    if (maxWait !== undefined && firstChangeTimeRef.current !== null) {
      const elapsed = Date.now() - firstChangeTimeRef.current;
      const remaining = maxWait - elapsed;

      if (remaining <= 0) {
        // Max wait time exceeded, update immediately
        const immediateHandler = setTimeout(() => {
          setDebouncedValue(value);
          firstChangeTimeRef.current = null;
          timeoutRef.current = null;
        }, 0);
        timeoutRef.current = immediateHandler;
        return () => clearTimeout(immediateHandler);
      } else if (remaining < delay) {
        // Max wait will be reached before normal delay
        const maxHandler = setTimeout(() => {
          setDebouncedValue(value);
          firstChangeTimeRef.current = null;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = null;
          maxWaitTimeoutRef.current = null;
        }, remaining);
        maxWaitTimeoutRef.current = maxHandler;
      }
    }

    // Set up the debounce timer
    const handler = setTimeout(() => {
      setDebouncedValue(value);
      firstChangeTimeRef.current = null;
      timeoutRef.current = null;
    }, delay);
    timeoutRef.current = handler;

    return () => {
      clearTimeout(handler);
      if (maxWaitTimeoutRef.current) {
        clearTimeout(maxWaitTimeoutRef.current);
      }
    };
  }, [value, delay, leading, maxWait]);

  return { debouncedValue, cancel };
}

export default useDebounce;
