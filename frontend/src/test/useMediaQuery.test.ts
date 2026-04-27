import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  between,
  breakpoints,
  down,
  mediaQueries,
  only,
  up,
  useMediaQuery,
} from '../hooks/useMediaQuery';

type MatchMediaListener = (event: MediaQueryListEvent) => void;

interface MockMediaQueryList {
  addEventListener: (type: 'change', listener: MatchMediaListener) => void;
  removeEventListener: (type: 'change', listener: MatchMediaListener) => void;
  addListener: (listener: MatchMediaListener) => void;
  removeListener: (listener: MatchMediaListener) => void;
  dispatch: (matches: boolean) => void;
  matches: boolean;
  media: string;
  onchange: MatchMediaListener | null;
}

function createMatchMediaMock(initialMatches = false) {
  const queries = new Map<string, MockMediaQueryList>();

  const getList = (query: string): MockMediaQueryList => {
    const existing = queries.get(query);

    if (existing) {
      return existing;
    }

    const listeners = new Set<MatchMediaListener>();
    const mediaQueryList: MockMediaQueryList = {
      matches: initialMatches,
      media: query,
      onchange: null,
      addEventListener: (_type, listener) => {
        listeners.add(listener);
      },
      removeEventListener: (_type, listener) => {
        listeners.delete(listener);
      },
      addListener: (listener) => {
        listeners.add(listener);
      },
      removeListener: (listener) => {
        listeners.delete(listener);
      },
      dispatch: (matches) => {
        mediaQueryList.matches = matches;
        const event = { matches, media: query } as MediaQueryListEvent;
        listeners.forEach((listener) => listener(event));
        mediaQueryList.onchange?.(event);
      },
    };

    queries.set(query, mediaQueryList);

    return mediaQueryList;
  };

  return {
    matchMedia: vi.fn((query: string) => getList(query)),
    getList,
  };
}

describe('useMediaQuery', () => {
  let matchMediaMock: ReturnType<typeof createMatchMediaMock>;
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    matchMediaMock = createMatchMediaMock();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock.matchMedia,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('returns the current match state for a query', () => {
    const query = up('md');
    matchMediaMock.getList(query).matches = true;

    const { result } = renderHook(() => useMediaQuery(query));

    expect(result.current).toBe(true);
  });

  it('updates when the media query match changes', () => {
    const query = up('lg');
    const { result } = renderHook(() => useMediaQuery(query));

    expect(result.current).toBe(false);

    act(() => {
      matchMediaMock.getList(query).dispatch(true);
    });

    expect(result.current).toBe(true);
  });

  it('exposes common breakpoint helpers', () => {
    expect(breakpoints.md).toBe(768);
    expect(up('sm')).toBe('(min-width: 640px)');
    expect(down('md')).toBe('(max-width: 1023.98px)');
    expect(between('sm', 'lg')).toBe(
      '(min-width: 640px) and (max-width: 1279.98px)'
    );
    expect(only('md')).toBe(
      '(min-width: 768px) and (max-width: 1023.98px)'
    );
    expect(mediaQueries.mobile).toBe('(max-width: 767.98px)');
    expect(mediaQueries.desktop).toBe('(min-width: 1024px)');
  });
});
