/**
 * Webhook Retry Queue & Shared Contract (Issue #1703)
 *
 * Implements the exact retry contract agreed upon with `client/src/webhook_retry.rs`
 * (see docs/adr/ADR-005-webhook-retry-contract.md).
 */

// ── Contract Constants (shared with client/src/webhook_retry.rs) ─────────────

/** Maximum delivery attempts before a job is moved to the DLQ. */
export const MAX_ATTEMPTS = 5;

/** Base delay for the first retry (1 second / 1000 ms). */
export const BASE_DELAY_SECS = 1;
export const BASE_DELAY_MS = 1000;

/** Cap the computed delay at 5 minutes (300 seconds / 300,000 ms). */
export const MAX_DELAY_SECS = 300;
export const MAX_DELAY_MS = 300_000;

// ── Data Structures ──────────────────────────────────────────────────────────

export interface WebhookJob {
  /** Unique job/event identifier. */
  id: string;
  /** Target destination URL. */
  url: string;
  /** JSON-serialized event payload string. */
  payload: string;
  /** Number of delivery attempts already executed. */
  attempts: number;
  /** Epoch timestamp in seconds after which the next attempt may be executed. */
  nextAttemptAt: number;
  /** Optional idempotency key (defaults to whk_<id>). */
  idempotencyKey: string;
}

export type DeliveryResult = 'Success' | 'Failure';

export function createWebhookJob(
  id: string,
  url: string,
  payload: string,
  idempotencyKey?: string
): WebhookJob {
  const now = Math.floor(Date.now() / 1000);
  return {
    id,
    url,
    payload,
    attempts: 0,
    nextAttemptAt: now,
    idempotencyKey: idempotencyKey || `whk_${id}`,
  };
}

/**
 * Compute the delay in seconds before the next retry using truncated exponential backoff:
 * min(BASE_DELAY_SECS * 2^attempts, MAX_DELAY_SECS)
 */
export function computeBackoffDelaySecs(attempts: number): number {
  const exp = BASE_DELAY_SECS * Math.pow(2, Math.min(attempts, 30));
  return Math.min(exp, MAX_DELAY_SECS);
}

/**
 * Record a failure on a job, incrementing attempt count and setting the next scheduled timestamp.
 */
export function recordJobFailure(job: WebhookJob, nowSecs: number = Math.floor(Date.now() / 1000)): void {
  job.attempts += 1;
  job.nextAttemptAt = nowSecs + computeBackoffDelaySecs(job.attempts);
}

/**
 * Check whether a job has reached or exceeded MAX_ATTEMPTS.
 */
export function isJobExhausted(job: WebhookJob): boolean {
  return job.attempts >= MAX_ATTEMPTS;
}

/**
 * Check whether a job is due for execution.
 */
export function isJobDue(job: WebhookJob, nowSecs: number = Math.floor(Date.now() / 1000)): boolean {
  return nowSecs >= job.nextAttemptAt;
}

// ── In-Memory Webhook Queue with DLQ ──────────────────────────────────────────

export class WebhookQueue {
  public pending: WebhookJob[] = [];
  public deadLetter: WebhookJob[] = [];

  enqueue(job: WebhookJob): void {
    this.pending.push(job);
  }

  /**
   * Process all jobs that are currently due.
   * `deliver` is a callback that attempts delivery and returns 'Success' or 'Failure'.
   */
  async tick(deliver: (job: WebhookJob) => Promise<DeliveryResult> | DeliveryResult, nowSecs?: number): Promise<void> {
    const currentSecs = nowSecs ?? Math.floor(Date.now() / 1000);
    const remaining: WebhookJob[] = [];

    const jobsToProcess = [...this.pending];
    this.pending = [];

    for (const job of jobsToProcess) {
      if (!isJobDue(job, currentSecs)) {
        remaining.push(job);
        continue;
      }

      const outcome = await deliver(job);
      if (outcome === 'Success') {
        // Delivered successfully — dropped from pending
      } else {
        recordJobFailure(job, currentSecs);
        if (isJobExhausted(job)) {
          this.deadLetter.push(job);
        } else {
          remaining.push(job);
        }
      }
    }

    this.pending = remaining;
  }

  /**
   * Drain all dead-lettered jobs for alerting / operator review.
   */
  drainDlq(): WebhookJob[] {
    const drained = this.deadLetter;
    this.deadLetter = [];
    return drained;
  }
}
