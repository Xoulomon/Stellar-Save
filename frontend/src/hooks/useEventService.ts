/**
 * useEventService.ts
 *
 * React hook wrapper for EventService.
 * Provides typed event listeners and auto-start on mount.
 */

import React, { useEffect, useCallback } from 'react';
import { EventService, type AppEvent, type EventType } from '../lib';

export interface UseEventServiceReturn {
  /** Service instance */
  service: EventService;
  /** Subscribe to events */
  on: (eventType: EventType | 'all', callback: (event: AppEvent) => void) => () => void;
  /** Manually start watching */
  start: () => Promise<void>;
  /** Manually stop watching */
  stop: () => void;
  /** Whether currently watching */
  isWatching: boolean;
}

/**
 * Hook for EventService integration.
 * Auto-starts watching on mount (if wallet ready), cleans up on unmount.
 */
export function useEventService(): UseEventServiceReturn {
  const service = EventService.getInstance();

  const start = useCallback(async () => {
    await service.startWatching();
  }, [service]);

  const stop = useCallback(() => {
    service.stopWatching();
  }, [service]);

  const on = useCallback((
    eventType: EventType | 'all',
    callback: (event: AppEvent) => void,
  ) => {
    return service.on(eventType, callback);
  }, [service]);

  // Auto-start on mount
  useEffect(() => {
    start().catch(console.error);

    return () => {
      stop();
    };
  }, [start, stop]);

  return {
    service,
    on,
    start,
    stop,
    isWatching: service['isWatching'], // private, but for convenience
  };
}
