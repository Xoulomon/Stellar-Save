import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAnalytics } from '../hooks/useAnalytics';

describe('useAnalytics', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts in loading state', () => {
    const { result } = renderHook(() => useAnalytics());
    expect(result.current.isLoading).toBe(true);
  });

  it('resolves with stats after timer fires', async () => {
    const { result } = renderHook(() => useAnalytics());
    await act(async () => { vi.runAllTimers(); });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.stats.totalContributed).toBeGreaterThan(0);
    expect(result.current.stats.onTimePercent).toBeGreaterThanOrEqual(0);
    expect(result.current.stats.onTimePercent).toBeLessThanOrEqual(100);
  });

  it('returns history data points', async () => {
    const { result } = renderHook(() => useAnalytics());
    await act(async () => { vi.runAllTimers(); });

    expect(result.current.history.length).toBeGreaterThan(0);
    for (const point of result.current.history) {
      expect(point.month).toBeTruthy();
      expect(typeof point.contributed).toBe('number');
      expect(typeof point.received).toBe('number');
    }
  });

  it('returns member comparison data including "You"', async () => {
    const { result } = renderHook(() => useAnalytics());
    await act(async () => { vi.runAllTimers(); });

    expect(result.current.memberComparison.length).toBeGreaterThan(0);
    expect(result.current.memberComparison.find((m) => m.label === 'You')).toBeDefined();
  });

  it('has no error', async () => {
    const { result } = renderHook(() => useAnalytics());
    await act(async () => { vi.runAllTimers(); });
    expect(result.current.error).toBeNull();
  });
});
