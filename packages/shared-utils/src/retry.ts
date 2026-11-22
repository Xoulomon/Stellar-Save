/**
 * Shared retry with exponential backoff and jitter.
 *
 * Several services in this repo call external systems — IPFS pinning nodes,
 * Soroban RPC endpoints, S3 — and each grew its own attempt loop. The loops
 * disagreed on how many attempts to make, whether to cap the delay, and whether
 * the operation was safe to replay, which is exactly the kind of divergence that
 * turns a transient blip into an outage.
 *
 * `withRetry` is the single implementation, built around the one question that
 * actually decides whether a retry is safe: **is this failure transient?**
 *
 * Replaying a request is not free of consequences. A POST that timed out after
 * the server accepted it must not be replayed blindly, or the caller pays twice.
 * Callers therefore pass `isRetryable`, and anything not explicitly deemed
 * transient fails on the first attempt.
 */

/** Configuration for {@link withRetry}. */
export interface RetryOptions {
  /**
   * Total attempts, including the first. Defaults to 3, so a default call makes
   * one request plus two retries.
   */
  attempts?: number;
  /**
   * Delay before the first retry, in milliseconds. Subsequent delays grow from
   * here. Defaults to 100.
   */
  initialDelayMs?: number;
  /**
   * Ceiling for a single delay, in milliseconds. Defaults to 5000, so a long
   * backoff cannot stall a request for minutes.
   */
  maxDelayMs?: number;
  /**
   * Growth factor applied per attempt. Defaults to 2.
   */
  backoffMultiplier?: number;
  /**
   * Fraction of the computed delay to randomise, in the range 0–1. Defaults to
   * 0.1. Jitter keeps a fleet of callers from retrying in lockstep after a shared
   * dependency recovers; set to 0 for deterministic delays in tests.
   */
  jitter?: number;
  /**
   * Decides whether a thrown value is worth retrying. When omitted every error
   * is retried, which suits idempotent operations only.
   *
   * @param error - The value the attempt threw
   * @param attempt - Zero-based index of the attempt that just failed
   */
  isRetryable?: (error: unknown, attempt: number) => boolean;
  /**
   * Invoked before each retry, after the delay. Use it for logging or metrics;
   * the delay has already elapsed when this runs.
   */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
  /** Injected for tests; defaults to the global `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for tests; defaults to `Math.random`. */
  random?: () => number;
}

const DEFAULTS = {
  attempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5_000,
  backoffMultiplier: 2,
  jitter: 0.1,
} as const;

/**
 * Resolves a timer at call time.
 *
 * This package compiles with `lib: ["ES2022"]` and no DOM or Node types, so
 * `setTimeout` is not in scope at compile time. Going through `globalThis` keeps
 * the package usable from the browser, Node and workers alike, and is resolved
 * when the retry actually runs rather than when the module is imported.
 */
type TimerFn = (handler: () => void, timeout: number) => unknown;

function getTimer(): TimerFn {
  const candidate = (globalThis as { setTimeout?: unknown }).setTimeout;
  if (typeof candidate !== 'function') {
    throw new Error('No setTimeout available; pass options.sleep to withRetry');
  }
  return candidate as TimerFn;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    getTimer()(resolve, ms);
  });

/**
 * Computes the delay before the next attempt.
 *
 * Exponential from `initialDelayMs`, capped at `maxDelayMs`, then jittered
 * downward only — randomising upward could push a delay past `maxDelayMs`, and
 * the cap exists to bound how long a caller can be held.
 *
 * @param attempt - Zero-based index of the attempt that just failed
 * @param options - Resolved retry options
 * @returns Delay in milliseconds, never negative
 * @internal Exported for unit tests only; not part of the package's public API.
 */
export function computeBackoffDelay(
  attempt: number,
  options: Required<
    Pick<RetryOptions, 'initialDelayMs' | 'maxDelayMs' | 'backoffMultiplier' | 'jitter'>
  > & {
    random?: () => number;
  }
): number {
  const { initialDelayMs, maxDelayMs, backoffMultiplier, jitter } = options;
  const random = options.random ?? Math.random;

  const exponential = initialDelayMs * backoffMultiplier ** attempt;
  const capped = Math.min(exponential, maxDelayMs);
  if (jitter <= 0) return Math.max(0, Math.round(capped));

  // Clamped so an out-of-range setting cannot invert or amplify the delay.
  const jitterFraction = Math.min(Math.max(jitter, 0), 1);
  const jittered = capped * (1 - jitterFraction * random());
  return Math.max(0, Math.round(jittered));
}

/**
 * Runs `fn`, retrying transient failures with exponential backoff and jitter.
 *
 * The last failure is rethrown once the attempts are exhausted, so callers see
 * the original error rather than a wrapper. A non-retryable failure is
 * rethrown immediately without further attempts.
 *
 * @param fn - Operation to run. Receives the zero-based attempt index.
 * @param options - Retry configuration
 * @returns The first successful result
 * @throws The final error, or the first non-retryable error
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T> | T,
  options: RetryOptions = {}
): Promise<T> {
  const attempts = options.attempts ?? DEFAULTS.attempts;
  const sleep = options.sleep ?? defaultSleep;
  const random = options.random ?? Math.random;

  if (attempts < 1) {
    throw new RangeError(`attempts must be at least 1, got ${attempts}`);
  }

  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === attempts - 1;
      if (isLastAttempt) break;

      // A caller that has not opted in gets every error retried, which is the
      // historical behaviour of the loops this replaces. `isRetryable` is how a
      // caller states that replaying is actually safe.
      const retryable = options.isRetryable ? options.isRetryable(error, attempt) : true;
      if (!retryable) throw error;

      const delayMs = computeBackoffDelay(attempt, {
        initialDelayMs: options.initialDelayMs ?? DEFAULTS.initialDelayMs,
        maxDelayMs: options.maxDelayMs ?? DEFAULTS.maxDelayMs,
        backoffMultiplier: options.backoffMultiplier ?? DEFAULTS.backoffMultiplier,
        jitter: options.jitter ?? DEFAULTS.jitter,
        random,
      });

      options.onRetry?.({ attempt, delayMs, error });
      await sleep(delayMs);
    }
  }

  throw lastError;
}
