import { useSyncExternalStore } from 'react';

export const breakpoints = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

const breakpointOrder = Object.keys(breakpoints) as Breakpoint[];

export function up(breakpoint: Breakpoint): string {
  return `(min-width: ${breakpoints[breakpoint]}px)`;
}

export function down(breakpoint: Breakpoint): string {
  const nextBreakpoint = breakpointOrder[breakpointOrder.indexOf(breakpoint) + 1];

  if (!nextBreakpoint) {
    return up(breakpoint);
  }

  return `(max-width: ${breakpoints[nextBreakpoint] - 0.02}px)`;
}

export function between(minBreakpoint: Breakpoint, maxBreakpoint: Breakpoint): string {
  return `${up(minBreakpoint)} and ${down(maxBreakpoint)}`;
}

export function only(breakpoint: Breakpoint): string {
  return between(breakpoint, breakpoint);
}

function getSnapshot(query: string): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(query).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

function subscribe(query: string, onStoreChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }

  const mediaQueryList = window.matchMedia(query);
  const listener = () => onStoreChange();

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', listener);

    return () => mediaQueryList.removeEventListener('change', listener);
  }

  mediaQueryList.addListener(listener);

  return () => mediaQueryList.removeListener(listener);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => subscribe(query, onStoreChange),
    () => getSnapshot(query),
    getServerSnapshot
  );
}

export const mediaQueries = {
  mobile: down('sm'),
  tablet: only('md'),
  desktop: up('lg'),
} as const;

export default useMediaQuery;
