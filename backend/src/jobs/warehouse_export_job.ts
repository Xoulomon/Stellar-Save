/**
 * Job scheduler for warehouse export.
 * Separates job scheduling from handler logic.
 *
 * Idempotency & retry:
 * - Guards against overlapping runs (a run in progress prevents a new one).
 * - Skips exports for a window that has already been exported successfully.
 * - Routes retries through the shared `jobRetryPolicy` from `lib/retry_policies`.
 */
import { S3Client } from '@aws-sdk/client-s3';

import { config } from '../config';
import { logger } from '../logger';
import { jobRetryPolicy } from '../lib/retry_policies';
import { WarehouseHandler } from './handlers/warehouse.handler';

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let lastExportedWindow: string | null = null;

/**
 * Computes a stable identifier for the export window based on the interval.
 * Two runs within the same window are considered duplicates.
 */
export function computeExportWindow(now: number, intervalMs: number): string {
  const windowIndex = Math.floor(now / intervalMs);
  return `window-${windowIndex}`;
}

/**
 * Resets internal state. Intended for tests.
 */
export function resetWarehouseExportJobState(): void {
  running = false;
  lastExportedWindow = null;
}

export function startWarehouseExportJob(opts: {
  intervalMs?: number;
  bucket?: string;
  region?: string;
  alertWebhook?: string;
}): void {
  const bucket = opts.bucket || config.backup.bucket;
  const intervalMs = opts.intervalMs ?? 60 * 60 * 1000;

  const s3 = new S3Client({ region: opts.region || config.aws.region });
  const handler = new WarehouseHandler({
    s3Client: s3,
    bucket,
    alertWebhook: opts.alertWebhook || config.backup.alertWebhookUrl,
  });

  const run = async () => {
    if (running) {
      logger.warn('[warehouse-job] Skipping run: previous export still in progress');
      return;
    }

    const window = computeExportWindow(Date.now(), intervalMs);
    if (lastExportedWindow === window) {
      logger.info(`[warehouse-job] Skipping run: window ${window} already exported`);
      return;
    }

    running = true;
    try {
      await jobRetryPolicy.execute(() => handler.execute());
      lastExportedWindow = window;
    } catch (err) {
      logger.error('[warehouse-job] Export failed after retries', err);
    } finally {
      running = false;
    }
  };

  // Run once immediately, then on the interval
  run().catch(() => {});
  timer = setInterval(run, intervalMs);
  logger.info(`[warehouse-job] Scheduled every ${intervalMs / 1000}s → s3://${bucket}`);
}

export function stopWarehouseExportJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}