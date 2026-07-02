import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTransaction } from '../useTransaction';

describe('useTransaction', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useTransaction());
    expect(result.current.state).toBe('idle');
    expect(result.current.txHash).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('transitions to confirmed on success', async () => {
    const { result } = renderHook(() => useTransaction());
    await act(async () => {
      await result.current.execute(() => Promise.resolve('abc123'));
    });
    expect(result.current.state).toBe('confirmed');
    expect(result.current.txHash).toBe('abc123');
    expect(result.current.error).toBeNull();
  });

  it('transitions to failed on error', async () => {
    const { result } = renderHook(() => useTransaction());
    await act(async () => {
      await result.current.execute(() => Promise.reject(new Error('tx rejected')));
    });
    expect(result.current.state).toBe('failed');
    expect(result.current.error).toBe('tx rejected');
    expect(result.current.txHash).toBeNull();
  });

  it('resets state', async () => {
    const { result } = renderHook(() => useTransaction());
    await act(async () => {
      await result.current.execute(() => Promise.resolve('abc123'));
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.state).toBe('idle');
    expect(result.current.txHash).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
