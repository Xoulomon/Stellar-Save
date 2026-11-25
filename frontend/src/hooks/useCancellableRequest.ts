import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_LANE = 'default';

export interface RequestScope {
  readonly id: number;
  readonly signal: AbortSignal;
  isActive: () => boolean;
  abort: () => void;
}

export interface CancellableRequestControls {
  begin: (lane?: string) => RequestScope;
  cancel: (lane?: string) => void;
}

export function useCancellableRequest(): CancellableRequestControls {
  const mountedRef = useRef(true);
  const latestIdsRef = useRef(new Map<string, number>());
  const controllersRef = useRef(new Map<string, AbortController>());

  const cancel = useCallback((lane: string = DEFAULT_LANE) => {
    const controller = controllersRef.current.get(lane);
    controller?.abort();
    controllersRef.current.delete(lane);
    latestIdsRef.current.set(lane, (latestIdsRef.current.get(lane) ?? 0) + 1);
  }, []);

  const begin = useCallback((lane: string = DEFAULT_LANE) => {
    const existing = controllersRef.current.get(lane);
    existing?.abort();

    const controller = new AbortController();
    controllersRef.current.set(lane, controller);
    const id = (latestIdsRef.current.get(lane) ?? 0) + 1;
    latestIdsRef.current.set(lane, id);

    return {
      id,
      signal: controller.signal,
      isActive: () =>
        mountedRef.current &&
        !controller.signal.aborted &&
        latestIdsRef.current.get(lane) === id,
      abort: () => cancel(lane),
    };
  }, [cancel]);

  useEffect(() => {
    const controllers = controllersRef.current;
    const latestIds = latestIdsRef.current;
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
      for (const lane of latestIds.keys()) {
        latestIds.set(lane, (latestIds.get(lane) ?? 0) + 1);
      }
    };
  }, []);

  return { begin, cancel };
}
