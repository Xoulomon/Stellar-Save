import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCancellableRequest } from '../useCancellableRequest';

describe('useCancellableRequest', () => {
  it('starts an active request with an abort signal', () => {
    const { result } = renderHook(() => useCancellableRequest());

    let scope: ReturnType<typeof result.current.begin> | undefined;
    act(() => {
      scope = result.current.begin();
    });

    expect(scope?.isActive()).toBe(true);
    expect(scope?.signal.aborted).toBe(false);
  });

  it('invalidates and aborts the previous request in the same lane', () => {
    const { result } = renderHook(() => useCancellableRequest());

    let first: ReturnType<typeof result.current.begin> | undefined;
    let second: ReturnType<typeof result.current.begin> | undefined;
    act(() => {
      first = result.current.begin('search');
      second = result.current.begin('search');
    });

    expect(first?.isActive()).toBe(false);
    expect(first?.signal.aborted).toBe(true);
    expect(second?.isActive()).toBe(true);
    expect(second?.id).toBeGreaterThan(first?.id ?? 0);
  });

  it('keeps independent lanes from cancelling each other', () => {
    const { result } = renderHook(() => useCancellableRequest());

    let load: ReturnType<typeof result.current.begin> | undefined;
    let loadMore: ReturnType<typeof result.current.begin> | undefined;
    act(() => {
      load = result.current.begin('load');
      loadMore = result.current.begin('loadMore');
    });

    expect(load?.isActive()).toBe(true);
    expect(loadMore?.isActive()).toBe(true);
  });

  it('cancels only the requested lane', () => {
    const { result } = renderHook(() => useCancellableRequest());

    let load: ReturnType<typeof result.current.begin> | undefined;
    let loadMore: ReturnType<typeof result.current.begin> | undefined;
    act(() => {
      load = result.current.begin('load');
      loadMore = result.current.begin('loadMore');
      result.current.cancel('load');
    });

    expect(load?.isActive()).toBe(false);
    expect(load?.signal.aborted).toBe(true);
    expect(loadMore?.isActive()).toBe(true);
  });

  it('allows a scope to abort itself', () => {
    const { result } = renderHook(() => useCancellableRequest());

    let scope: ReturnType<typeof result.current.begin> | undefined;
    act(() => {
      scope = result.current.begin();
      scope?.abort();
    });

    expect(scope?.isActive()).toBe(false);
    expect(scope?.signal.aborted).toBe(true);
  });

  it('invalidates every in-flight request on unmount', () => {
    const { result, unmount } = renderHook(() => useCancellableRequest());

    let load: ReturnType<typeof result.current.begin> | undefined;
    let loadMore: ReturnType<typeof result.current.begin> | undefined;
    act(() => {
      load = result.current.begin('load');
      loadMore = result.current.begin('loadMore');
    });

    unmount();

    expect(load?.isActive()).toBe(false);
    expect(load?.signal.aborted).toBe(true);
    expect(loadMore?.isActive()).toBe(false);
    expect(loadMore?.signal.aborted).toBe(true);
  });
});
