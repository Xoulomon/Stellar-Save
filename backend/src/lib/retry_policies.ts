import type { RetryOptions } from '@stellar-save/shared-utils';

/**
 * Named retry policy for Soroban RPC operations.
 * Capped exponential backoff (initial 1000ms, max 10000ms, 3 attempts).
 */
export const rpcRetryPolicy: RetryOptions = {
  attempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: 0.1,
  isRetryable: (error: unknown) => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('timeout') ||
        msg.includes('econnrefused') ||
        msg.includes('fetch failed') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504')
      );
    }
    return true;
  },
};

/**
 * Named retry policy for Stellar Horizon operations.
 * Capped exponential backoff (initial 500ms, max 5000ms, 3 attempts).
 */
export const horizonRetryPolicy: RetryOptions = {
  attempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitter: 0.1,
  isRetryable: (error: unknown) => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      return (
        msg.includes('429') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504') ||
        msg.includes('econnreset') ||
        msg.includes('fetch failed')
      );
    }
    return true;
  },
};

/**
 * Named retry policy for Webhook delivery operations.
 * Exponential backoff conforming to contract (initial 1000ms, max 300000ms, 5 attempts).
 */
export const webhookRetryPolicy: RetryOptions = {
  attempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 300000,
  backoffMultiplier: 2,
  jitter: 0.1,
  isRetryable: (_error: unknown) => {
    return true;
  },
};

/**
 * Named retry policy for transactional Email delivery (SendGrid).
 * Capped exponential backoff (initial 1000ms, max 5000ms, 3 attempts).
 */
export const emailRetryPolicy: RetryOptions = {
  attempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  jitter: 0.1,
  isRetryable: (error: unknown) => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('template') && msg.includes('not found')) {
        return false;
      }
    }
    return true;
  },
};

/**
 * Named retry policy for background job handlers.
 *
 * Shared retry contract for all job handlers so retry behavior is consistent
 * and idempotency assumptions are explicit:
 * - attempts: 5 total attempts (1 initial + 4 retries).
 * - backoff: capped exponential, initial 1000ms, max 60000ms, multiplier 2.
 * - jitter: 0.1 (10%) to avoid thundering-herd retries across workers.
 * - isRetryable: transient/network/server errors are retried; permanent
 *   errors (validation, not found, auth, bad request) are not, so handlers
 *   are not re-run for failures that cannot succeed on retry.
 */
export const jobRetryPolicy: RetryOptions = {
  attempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  jitter: 0.1,
  isRetryable: (error: unknown) => {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      // Permanent failures: do not retry.
      if (
        msg.includes('validation') ||
        msg.includes('invalid') ||
        msg.includes('not found') ||
        msg.includes('unauthorized') ||
        msg.includes('forbidden') ||
        msg.includes('bad request') ||
        msg.includes('400') ||
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('404') ||
        msg.includes('422')
      ) {
        return false;
      }
      // Transient failures: retry.
      return (
        msg.includes('timeout') ||
        msg.includes('econnrefused') ||
        msg.includes('econnreset') ||
        msg.includes('fetch failed') ||
        msg.includes('429') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504')
      );
    }
    // Unknown error shapes are treated as retryable to avoid silent data loss.
    return true;
  },
};
