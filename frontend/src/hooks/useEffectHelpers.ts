import { DependencyList, EffectCallback, useEffect, useRef } from 'react';

/**
 * Shared effect helpers used by the custom hooks in `frontend/src/hooks`.
 *
 * These utilities consolidate the duplicated effect logic that previously
 * lived in several hooks (mount-only effects, debounced effects, and
 * cleanup-safe async effects). They are additive and do not change any
 * existing hook signatures or return values.
 */

/**
 * Runs an effect only once on mount. The effect may return a cleanup
 * function which is invoked on unmount.
 */
export function useMountEffect(effect: EffectCallback): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}

/**
 * Runs an effect only when the provided dependencies change, skipping the
 * initial mount. Useful for reacting to updates without duplicating the
 * "isFirstRender" ref pattern across hooks.
 */
export function useUpdateEffect(
  effect: EffectCallback,
  deps: DependencyList = [],
): void {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return undefined;
    }

    return effect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Runs an effect after the given delay, cancelling the pending invocation
 * whenever the dependencies change or the component unmounts. This replaces
 * the repeated `setTimeout`/`clearTimeout` effect bodies found in hooks such
 * as debounced value/search hooks.
 */
export function useDebouncedEffect(
  effect: EffectCallback,
  deps: DependencyList,
  delay: number,
): void {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      effect();
    }, delay);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}

/**
 * Runs an async effect and guards against state updates after unmount.
 * The callback receives an `isActive` accessor so hooks can avoid the
 * duplicated `let cancelled = false` boilerplate.
 */
export function useAsyncEffect(
  effect: (isActive: () => boolean) => void | Promise<void>,
  deps: DependencyList = [],
): void {
  useEffect(() => {
    let cancelled = false;
    const isActive = () => !cancelled;

    void effect(isActive);

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
