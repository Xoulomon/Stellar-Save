import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAsyncData, useSimulatedLoading, mockDelay } from '../useAsyncData';

describe('mockDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the factory result after the delay', async () => {
    const promise = mockDelay(() => 'hello', 100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBe('hello');
  });

  it('rejects if the factory throws', async () => {
    const promise = mockDelay(() => {
      throw new Error('boom');
    }, 50);
    await vi.advanceTimersByTimeAsync(50);
    await expect(promise).rejects.toThrow('boom');
  });
});

describe('useAsyncData', () => {
  it('starts loading and resolves with data', async () => {
    const { result } = renderHook(() =>
      useAsyncData(() => Promise.resolve('value'), []),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBe('value');
    expect(result.current.error).toBeNull();
  });

  it('surfaces a rejection as an error message', async () => {
    const { result } = renderHook(() =>
      useAsyncData(() => Promise.reject(new Error('failed to load')), []),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('failed to load');
    expect(result.current.data).toBeNull();
  });

  it('stringifies non-Error rejections', async () => {
    const { result } = renderHook(() =>
      useAsyncData(() => Promise.reject('plain string failure'), []),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('plain string failure');
  });

  it('does not load while disabled, and starts once enabled', async () => {
    const loader = vi.fn(() => Promise.resolve('loaded'));
    const { result, rerender } = renderHook(
      ({ enabled }) => useAsyncData(loader, [], { enabled }),
      { initialProps: { enabled: false } },
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(loader).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.data).toBe('loaded');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('reloads when a dependency changes', async () => {
    const loader = vi.fn((id: string) => Promise.resolve(`data-${id}`));
    const { result, rerender } = renderHook(
      ({ id }) => useAsyncData(() => loader(id), [id]),
      { initialProps: { id: 'a' } },
    );

    await waitFor(() => expect(result.current.data).toBe('data-a'));

    rerender({ id: 'b' });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe('data-b'));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('refetch() reruns the loader', async () => {
    let call = 0;
    const loader = vi.fn(() => Promise.resolve(`result-${++call}`));
    const { result } = renderHook(() => useAsyncData(loader, []));

    await waitFor(() => expect(result.current.data).toBe('result-1'));

    act(() => {
      result.current.refetch();
    });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe('result-2'));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('ignores a resolved value if the hook was disabled/changed before it landed', async () => {
    let resolveFirst: (value: string) => void = () => {};
    const first = new Promise<string>((resolve) => {
      resolveFirst = resolve;
    });
    const loader = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(Promise.resolve('second'));

    const { result, rerender } = renderHook(
      ({ id }) => useAsyncData(loader, [id]),
      { initialProps: { id: 'a' } },
    );

    rerender({ id: 'b' });
    await waitFor(() => expect(result.current.data).toBe('second'));

    // The stale first promise resolving afterwards must not clobber 'second'.
    await act(async () => {
      resolveFirst('stale');
    });

    expect(result.current.data).toBe('second');
  });
});

describe('useSimulatedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is true immediately and false after the delay elapses', async () => {
    const { result } = renderHook(() => useSimulatedLoading(500));

    expect(result.current).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current).toBe(false);
  });
});
