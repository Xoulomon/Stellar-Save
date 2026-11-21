import { withRetry } from '@stellar-save/shared-utils';

import {
  rpcRetryPolicy,
  horizonRetryPolicy,
  webhookRetryPolicy,
  emailRetryPolicy,
} from '../lib/retry_policies';

describe('Named Retry Policies', () => {
  function recordingSleep() {
    const delays: number[] = [];
    const sleep = async (ms: number) => {
      delays.push(ms);
    };
    return { delays, sleep };
  }

  describe('rpcRetryPolicy', () => {
    it('defines expected policy properties', () => {
      expect(rpcRetryPolicy.attempts).toBe(3);
      expect(rpcRetryPolicy.initialDelayMs).toBe(1000);
      expect(rpcRetryPolicy.maxDelayMs).toBe(10000);
      expect(rpcRetryPolicy.backoffMultiplier).toBe(2);
    });

    it('retries with exponential backoff on transient errors and asserts attempts', async () => {
      const { delays, sleep } = recordingSleep();
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('RPC call timed out'))
        .mockRejectedValueOnce(new Error('fetch failed (ECONNREFUSED)'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, {
        ...rpcRetryPolicy,
        sleep,
        jitter: 0,
      });

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
      expect(delays).toEqual([1000, 2000]);
    });

    it('stops after max attempts on permanent failure', async () => {
      const { delays, sleep } = recordingSleep();
      const fn = jest.fn().mockRejectedValue(new Error('timeout error'));

      await expect(
        withRetry(fn, {
          ...rpcRetryPolicy,
          sleep,
          jitter: 0,
        })
      ).rejects.toThrow('timeout error');

      expect(fn).toHaveBeenCalledTimes(3);
      expect(delays).toEqual([1000, 2000]);
    });
  });

  describe('horizonRetryPolicy', () => {
    it('defines expected policy properties', () => {
      expect(horizonRetryPolicy.attempts).toBe(3);
      expect(horizonRetryPolicy.initialDelayMs).toBe(500);
      expect(horizonRetryPolicy.maxDelayMs).toBe(5000);
      expect(horizonRetryPolicy.backoffMultiplier).toBe(2);
    });

    it('retries Horizon 429 / 5xx with backoff', async () => {
      const { delays, sleep } = recordingSleep();
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Horizon responded 429 Too Many Requests'))
        .mockResolvedValue({ ledger: 100 });

      const result = await withRetry(fn, {
        ...horizonRetryPolicy,
        sleep,
        jitter: 0,
      });

      expect(result).toEqual({ ledger: 100 });
      expect(fn).toHaveBeenCalledTimes(2);
      expect(delays).toEqual([500]);
    });
  });

  describe('webhookRetryPolicy', () => {
    it('defines expected policy properties for 5 attempts', () => {
      expect(webhookRetryPolicy.attempts).toBe(5);
      expect(webhookRetryPolicy.initialDelayMs).toBe(1000);
      expect(webhookRetryPolicy.maxDelayMs).toBe(300000);
      expect(webhookRetryPolicy.backoffMultiplier).toBe(2);
    });

    it('asserts 5 attempt progression with exponential delays', async () => {
      const { delays, sleep } = recordingSleep();
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('webhook endpoint 500'))
        .mockRejectedValueOnce(new Error('webhook endpoint 502'))
        .mockRejectedValueOnce(new Error('webhook endpoint 503'))
        .mockRejectedValueOnce(new Error('webhook endpoint 504'))
        .mockResolvedValue('delivered');

      const result = await withRetry(fn, {
        ...webhookRetryPolicy,
        sleep,
        jitter: 0,
      });

      expect(result).toBe('delivered');
      expect(fn).toHaveBeenCalledTimes(5);
      expect(delays).toEqual([1000, 2000, 4000, 8000]);
    });
  });

  describe('emailRetryPolicy', () => {
    it('defines expected policy properties', () => {
      expect(emailRetryPolicy.attempts).toBe(3);
      expect(emailRetryPolicy.initialDelayMs).toBe(1000);
      expect(emailRetryPolicy.maxDelayMs).toBe(5000);
      expect(emailRetryPolicy.backoffMultiplier).toBe(2);
    });

    it('retries transient email sending failures', async () => {
      const { delays, sleep } = recordingSleep();
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('SendGrid rate limit'))
        .mockResolvedValue([{ statusCode: 202 }]);

      const result = await withRetry(fn, {
        ...emailRetryPolicy,
        sleep,
        jitter: 0,
      });

      expect(result).toEqual([{ statusCode: 202 }]);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(delays).toEqual([1000]);
    });

    it('does not retry when template is not found', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Email template welcome_email not found'));

      await expect(
        withRetry(fn, {
          ...emailRetryPolicy,
          jitter: 0,
        })
      ).rejects.toThrow('Email template welcome_email not found');

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('fake timer verification', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('advances fake timers to execute retries', async () => {
      let callCount = 0;
      const fn = jest.fn(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('transient error');
        }
        return 'success';
      });

      const retryPromise = withRetry(fn, {
        attempts: 2,
        initialDelayMs: 250,
        jitter: 0,
      });

      // Initially run once
      expect(callCount).toBe(1);

      // Advance time by 250ms
      await jest.advanceTimersByTimeAsync(250);

      const result = await retryPromise;
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
