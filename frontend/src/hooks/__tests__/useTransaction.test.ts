import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { useTransaction, explorerUrl, STELLAR_NETWORK } from '../useTransaction';

// Use the shared mock — no live Horizon/RPC calls in unit tests.
// See frontend/src/__mocks__/@stellar/stellar-sdk.ts for the full stub surface.
vi.mock('@stellar/stellar-sdk');

describe('explorerUrl', () => {
  it('builds a stellar.expert URL for the configured network', () => {
    const url = explorerUrl('abc123');
    const expectedNet = STELLAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
    expect(url).toBe(`https://stellar.expert/explorer/${expectedNet}/tx/abc123`);
  });
});

describe('useTransaction', () => {
  it('starts in idle state', () => {
    const { result } = renderHook(() => useTransaction());
    expect(result.current.state).toBe('idle');
    expect(result.current.txHash).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('transitions to pending while the transaction is in flight', async () => {
    const { result } = renderHook(() => useTransaction());
    let resolveFn: (hash: string) => void;
    const pending = new Promise<string>((resolve) => {
      resolveFn = resolve;
    });

    let executePromise: Promise<void>;
    act(() => {
      executePromise = result.current.execute(() => pending);
    });

    expect(result.current.state).toBe('pending');
    expect(result.current.txHash).toBeNull();
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolveFn('abc123');
      await executePromise;
    });

    expect(result.current.state).toBe('confirmed');
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

  it('surfaces the rejection reason of a mocked Stellar SDK submitTransaction call', async () => {
    const { Horizon } = await import('@stellar/stellar-sdk');
    const server = new Horizon.Server('https://horizon-testnet.stellar.org');
    (server.submitTransaction as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('bad_seq'));

    const { result } = renderHook(() => useTransaction());
    await act(async () => {
      await result.current.execute(async () => {
        await server.submitTransaction();
        return 'unreachable';
      });
    });

    expect(result.current.state).toBe('failed');
    expect(result.current.error).toBe('bad_seq');
    expect(server.submitTransaction).toHaveBeenCalledTimes(1);
  });

  describe('timeout handling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('transitions to failed with a timeout error when fn() never resolves in time', async () => {
      const { result } = renderHook(() => useTransaction());
      const neverResolves = new Promise<string>(() => {});

      const executePromise = act(async () => {
        const p = result.current.execute(() => neverResolves, { timeoutMs: 5000 });
        await vi.advanceTimersByTimeAsync(5000);
        await p;
      });

      await executePromise;

      expect(result.current.state).toBe('failed');
      expect(result.current.error).toBe('Transaction timed out');
      expect(result.current.txHash).toBeNull();
    });

    it('does not time out if fn() resolves before timeoutMs', async () => {
      const { result } = renderHook(() => useTransaction());

      await act(async () => {
        await result.current.execute(() => Promise.resolve('abc123'), { timeoutMs: 5000 });
      });

      expect(result.current.state).toBe('confirmed');
      expect(result.current.txHash).toBe('abc123');
    });
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
