import { describe, it, expect } from 'vitest';
import {
  breakpoints,
  mobileBreakpoints,
  mediaQueries,
  getMediaQuery,
  isMobileBreakpoint,
  resolveBreakpoint,
} from './breakpoints';

describe('breakpoints', () => {
  it('exposes the canonical breakpoint scale in ascending order', () => {
    const values = Object.values(breakpoints);
    const sorted = [...values].sort((a, b) => a - b);
    expect(values).toEqual(sorted);
  });

  it('keeps mobile breakpoints as a subset of the canonical scale', () => {
    for (const value of Object.values(mobileBreakpoints)) {
      expect(Object.values(breakpoints)).toContain(value);
    }
  });
});

describe('mediaQueries', () => {
  it('builds min-width queries from the canonical scale', () => {
    for (const [name, value] of Object.entries(breakpoints)) {
      expect(mediaQueries[name as keyof typeof breakpoints]).toBe(
        `(min-width: ${value}px)`,
      );
    }
  });
});

describe('getMediaQuery', () => {
  it('returns the media query for a known breakpoint', () => {
    expect(getMediaQuery('md')).toBe(mediaQueries.md);
  });

  it('returns undefined for an unknown breakpoint', () => {
    expect(getMediaQuery('unknown' as never)).toBeUndefined();
  });
});

describe('isMobileBreakpoint', () => {
  it('returns true for mobile breakpoints', () => {
    expect(isMobileBreakpoint('sm')).toBe(true);
  });

  it('returns false for non-mobile breakpoints', () => {
    expect(isMobileBreakpoint('lg')).toBe(false);
  });

  it('returns false for unknown breakpoints', () => {
    expect(isMobileBreakpoint('unknown' as never)).toBe(false);
  });
});

describe('resolveBreakpoint', () => {
  it('resolves the largest breakpoint that fits the width', () => {
    expect(resolveBreakpoint(0)).toBe('xs');
    expect(resolveBreakpoint(breakpoints.md)).toBe('md');
    expect(resolveBreakpoint(breakpoints.md - 1)).toBe('sm');
  });

  it('falls back to the smallest breakpoint for negative widths', () => {
    expect(resolveBreakpoint(-1)).toBe('xs');
  });
});
