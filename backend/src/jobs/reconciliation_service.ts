import { Redis } from 'ioredis';
import { logger } from '../utils/logger';
import { metrics } from '../metrics';
import { jobRetryPolicy, RetryPolicy } from '../lib/retry_policies';

/**
 * Common background-job abstraction.
 *
 * Every scheduled unit of work is described by a `Job` and executed by the
 * shared `JobRunner`, which provides distributed locking (via Redis) and a
 * single failure/retry/reporting path.
 */
export interface Job {
  /** Unique, stable job name used for locking and metrics. */
  name: string;
  /** Interval in milliseconds between runs. */
  schedule: number;
  /** The work to perform. */
  run: () => Promise<void>;
}

export interface JobRunnerOptions {
  redis: Redis;
  /** Lock TTL in milliseconds. Defaults to 5 minutes. */
  lockTtlMs?: number;
  /** Retry policy used for job runs. Defaults to `jobRetryPolicy`. */
  retryPolicy?: RetryPolicy;
  /** Idempotency window in milliseconds. Defaults to 5 minutes. */
  idempotencyWindowMs?: number;
}

const DEFAULT_LOCK_TTL_MS = 5 * 60 * 1000;
const DEFAULT_IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

/**
 * Runs registered jobs on their schedules, guaranteeing that at most one
 * instance executes a given job at a time via a Redis lock.
 */
export class JobRunner {
  private readonly redis: Redis;
  private readonly lockTtlMs: number;
  private readonly retryPolicy: RetryPolicy;
  private readonly idempotencyWindowMs: number;
  private readonly jobs = new Map<string, Job>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private started = false;

  constructor(options: JobRunnerOptions) {
    this.redis = options.redis;
    this.lockTtlMs = options.lockTtlMs ?? DEFAULT_LOCK_TTL_MS;
    this.retryPolicy = options.retryPolicy ?? jobRetryPolicy;
    this.idempotencyWindowMs = options.idempotencyWindowMs ?? DEFAULT_IDEMPOTENCY_WINDOW_MS;
  }

  register(job: Job): void {
    if (this.jobs.has(job.name)) {
      throw new Error(`Job already registered: ${job.name}`);
    }
    this.jobs.set(job.name, job);
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    for (const job of this.jobs.values()) {
      const timer = setInterval(() => {
        void this.execute(job);
      }, job.schedule);
      this.timers.set(job.name, timer);
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.started = false;
  }

  /**
   * Execute a job once, guarded by a distributed lock, an idempotency key and
   * the shared retry policy. Re-running the same job within the idempotency
   * window is a no-op, making handlers safe to retry. Exposed for tests and
   * manual runs.
   */
  async execute(job: Job): Promise<void> {
    const lockKey = `job:lock:${job.name}`;
    const lockValue = `${process.pid}:${Date.now()}:${Math.random()}`;
    const acquired = await this.redis.set(lockKey, lockValue, 'PX', this.lockTtlMs, 'NX');

    if (acquired !== 'OK') {
      logger.debug(`Job ${job.name} skipped: lock held by another instance`);
      return;
    }

    try {
      const idempotencyKey = this.idempotencyKey(job);
      const firstRun = await this.redis.set(
        idempotencyKey,
        '1',
        'PX',
        this.idempotencyWindowMs,
        'NX',
      );
      if (firstRun !== 'OK') {
        logger.debug(`Job ${job.name} skipped: already executed in this window`);
        return;
      }

      await this.runWithRetry(job);
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  private idempotencyKey(job: Job): string {
    const window = Math.floor(Date.now() / this.idempotencyWindowMs);
    return `job:idempotency:${job.name}:${window}`;
  }

  private async runWithRetry(job: Job): Promise<void> {
    try {
      await this.retryPolicy.execute(() => job.run());
      metrics.recordJobSuccess(job.name);
      logger.info(`Job ${job.name} succeeded`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      metrics.recordJobFailure(job.name);
      logger.error(`Job ${job.name} failed after retries`, { error: err.message });
    }
  }

  private async releaseLock(lockKey: string, lockValue: string): Promise<void> {
    // Only release the lock if we still own it.
    const script =
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";
    try {
      await this.redis.eval(script, 1, lockKey, lockValue);
    } catch (error) {
      logger.warn(`Failed to release lock ${lockKey}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Reconciliation job migrated onto the shared runner.
 *
 * The handler is idempotent: the runner dedupes repeated executions within the
 * idempotency window, so re-running reconciliation is safe.
 */
export function createReconciliationJob(
  reconcile: () => Promise<void>,
  scheduleMs: number,
): Job {
  return {
    name: 'reconciliation',
    schedule: scheduleMs,
    run: reconcile,
  };
}
