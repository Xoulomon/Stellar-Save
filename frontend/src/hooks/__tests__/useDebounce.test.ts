import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebounce, useDebounceWithCancel } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial'));
    expect(result.current).toBe('initial');
  });

  it('delays updating the value until the default 500ms elapse', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('b');
  });

  it('respects a custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, { delay: 200 }),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('b');
  });

  it('resets the timer on rapid successive changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender({ value: 'c' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Only 300ms have elapsed since the last change ('c'), so it shouldn't
    // have committed yet — the debounce window should have restarted.
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('c');
  });

  it('updates immediately when leading is true', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, { leading: true, delay: 500 }),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe('b');
  });

  it('forces an update once maxWait is exceeded despite continuous changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, { delay: 500, maxWait: 800 }),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    rerender({ value: 'c' }); // restarts the 500ms window, but not maxWait
    act(() => {
      vi.advanceTimersByTime(400); // total elapsed since first change: 800ms
    });

    expect(result.current).toBe('c');
  });
});

describe('useDebounceWithCancel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces the value like useDebounce', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounceWithCancel(value, { delay: 300 }),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    expect(result.current.debouncedValue).toBe('a');

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.debouncedValue).toBe('b');
  });

  it('cancel() prevents the pending update from applying', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounceWithCancel(value, { delay: 300 }),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });

    act(() => {
      result.current.cancel();
      vi.advanceTimersByTime(300);
    });

    expect(result.current.debouncedValue).toBe('a');
  });
});
