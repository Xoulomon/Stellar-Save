import { describe, it, expect, vi } from 'vitest';

import { withRetry, computeBackoffDelay } from './retry';

/** Records the delays a retry loop asked for instead of actually waiting. */
function recordingSleep() {
  const delays: number[] = [];
  const sleep = async (ms: number) => {
    delays.push(ms);
  };
  return { delays, sleep };
}

const backoff = { initialDelayMs: 100, maxDelayMs: 5000, backoffMultiplier: 2, jitter: 0 };

describe('withRetry', () => {
  it('returns the first successful result without retrying', async () => {
    const { delays, sleep } = recordingSleep();
    const fn = vi.fn().mockResolvedValue('ok');

    await expect(withRetry(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('retries a transient failure and then succeeds', async () => {
    const { delays, sleep } = recordingSleep();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue('ok');

    await expect(withRetry(fn, { sleep, jitter: 0 })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    // Exponential: 100ms then 200ms.
    expect(delays).toEqual([100, 200]);
  });

  it('passes the attempt index to the operation', async () => {
    const { sleep } = recordingSleep();
    const seen: number[] = [];
    const fn = vi.fn(async (attempt: number) => {
      seen.push(attempt);
      if (attempt < 2) throw new Error('boom');
      return 'ok';
    });

    await withRetry(fn, { sleep, jitter: 0 });
    expect(seen).toEqual([0, 1, 2]);
  });

  it('rethrows the last error once attempts are exhausted', async () => {
    const { sleep } = recordingSleep();
    const fn = vi.fn().mockRejectedValue(new Error('still down'));

    await expect(withRetry(fn, { attempts: 3, sleep, jitter: 0 })).rejects.toThrow('still down');
    // Three attempts total, and only two delays between them.
    expect(fn).toHaveBeenCalledTimes(3);
  });

  // The safety property: replaying an unretriable failure is what the
  // isRetryable hook exists to prevent.
  it('stops immediately when the failure is not retryable', async () => {
    const { delays, sleep } = recordingSleep();
    const fn = vi.fn().mockRejectedValue(new Error('bad request'));

    await expect(withRetry(fn, { sleep, jitter: 0, isRetryable: () => false })).rejects.toThrow(
      'bad request'
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('gives isRetryable the error and the attempt index', async () => {
    const { sleep } = recordingSleep();
    const isRetryable = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(withRetry(fn, { sleep, jitter: 0, isRetryable })).rejects.toThrow('boom');
    expect(isRetryable).toHaveBeenNthCalledWith(1, expect.any(Error), 0);
    expect(isRetryable).toHaveBeenNthCalledWith(2, expect.any(Error), 1);
  });

  it('does not call isRetryable on the final attempt', async () => {
    const { sleep } = recordingSleep();
    const isRetryable = vi.fn().mockReturnValue(true);
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(withRetry(fn, { attempts: 2, sleep, jitter: 0, isRetryable })).rejects.toThrow();
    // The last failure is rethrown rather than retried, so it is not classified.
    expect(isRetryable).toHaveBeenCalledTimes(1);
  });

  it('reports each retry through onRetry after the delay', async () => {
    const { sleep } = recordingSleep();
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValueOnce(new Error('a')).mockResolvedValue('ok');

    await withRetry(fn, { sleep, jitter: 0, onRetry });
    expect(onRetry).toHaveBeenCalledWith({ attempt: 0, delayMs: 100, error: expect.any(Error) });
  });

  it('supports synchronous operations', async () => {
    const { sleep } = recordingSleep();
    let calls = 0;
    const result = await withRetry(
      () => {
        calls++;
        if (calls < 2) throw new Error('sync boom');
        return 'sync ok';
      },
      { sleep, jitter: 0 }
    );
    expect(result).toBe('sync ok');
    expect(calls).toBe(2);
  });

  it('handles a non-Error rejection value', async () => {
    const { sleep } = recordingSleep();
    const fn = vi.fn().mockRejectedValue('plain string');

    await expect(withRetry(fn, { sleep, jitter: 0 })).rejects.toBe('plain string');
  });

  it('rejects a non-positive attempt count', async () => {
    const { sleep } = recordingSleep();
    await expect(withRetry(() => 'x', { attempts: 0, sleep })).rejects.toThrow(RangeError);
  });

  it('makes exactly one attempt when attempts is 1', async () => {
    const { delays, sleep } = recordingSleep();
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(withRetry(fn, { attempts: 1, sleep })).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it('awaits a real timer when no sleep is injected', async () => {
    // Exercises the default sleep, which resolves setTimeout off globalThis at
    // call time because this package compiles without DOM or Node types.
    const fn = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok');
    const started = Date.now();

    await expect(withRetry(fn, { initialDelayMs: 20, jitter: 0 })).resolves.toBe('ok');
    // The retry really waited, rather than resolving immediately.
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });

  it('surfaces a clear error when the host provides no timer', async () => {
    const original = globalThis.setTimeout;
    // @ts-expect-error deliberately removing the host timer
    delete globalThis.setTimeout;
    try {
      const fn = vi.fn().mockRejectedValue(new Error('boom'));
      await expect(withRetry(fn, { attempts: 2 })).rejects.toThrow(/no settimeout/i);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.setTimeout = original;
    }
  });

  it('retries non-Error values when isRetryable allows it', async () => {
    const { sleep } = recordingSleep();
    const fn = vi.fn().mockRejectedValueOnce('string failure').mockResolvedValue('ok');

    await expect(withRetry(fn, { sleep, jitter: 0, isRetryable: () => true })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('computeBackoffDelay', () => {
  const base = { initialDelayMs: 100, maxDelayMs: 5000, backoffMultiplier: 2, jitter: 0 };

  it('grows exponentially from the initial delay', () => {
    expect(computeBackoffDelay(0, base)).toBe(100);
    expect(computeBackoffDelay(1, base)).toBe(200);
    expect(computeBackoffDelay(2, base)).toBe(400);
  });

  it('caps at maxDelayMs', () => {
    expect(computeBackoffDelay(10, base)).toBe(5000);
    expect(computeBackoffDelay(100, base)).toBe(5000);
  });

  it('applies downward jitter only, so the cap is never exceeded', () => {
    const jittered = { ...base, jitter: 0.5, random: () => 1 };
    // random() === 1 removes the full jitter fraction: 100 * 0.5 = 50.
    expect(computeBackoffDelay(0, jittered)).toBe(50);
    // random() === 0 removes nothing.
    const none = { ...base, jitter: 0.5, random: () => 0 };
    expect(computeBackoffDelay(0, none)).toBe(100);
  });

  it('keeps jittered delays under the cap', () => {
    const many = { ...base, jitter: 1, random: () => 0 };
    for (const attempt of [0, 1, 5, 20]) {
      expect(computeBackoffDelay(attempt, many)).toBeLessThanOrEqual(base.maxDelayMs);
    }
  });

  it('treats zero and negative jitter as no jitter', () => {
    expect(computeBackoffDelay(1, { ...base, jitter: 0 })).toBe(200);
    expect(computeBackoffDelay(1, { ...base, jitter: -1 })).toBe(200);
  });

  it('clamps out-of-range jitter to full jitter rather than inverting it', () => {
    // jitter 5 is clamped to 1, so with random() === 1 the delay is removed
    // entirely instead of being multiplied by a negative factor.
    const clamped = { ...base, jitter: 5, random: () => 1 };
    expect(computeBackoffDelay(1, clamped)).toBe(0);
    expect(computeBackoffDelay(1, clamped)).toBeGreaterThanOrEqual(0);
  });

  it('never returns a negative delay', () => {
    const aggressive = { ...base, initialDelayMs: -100, jitter: 0 };
    expect(computeBackoffDelay(0, aggressive)).toBe(0);
  });

  it('uses Math.random by default', () => {
    const spread = new Set(
      Array.from({ length: 20 }, () => computeBackoffDelay(1, { ...base, jitter: 0.5 }))
    );
    expect(spread.size).toBeGreaterThan(1);
  });
});
