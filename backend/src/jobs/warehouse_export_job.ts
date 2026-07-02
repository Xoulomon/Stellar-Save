/**
 * Scheduled warehouse export job.
 * Wired up in main.ts / app startup when WAREHOUSE_EXPORT_ENABLED=true.
 */
import { S3Client } from '@aws-sdk/client-s3';
import { WarehouseExportPipeline } from '../warehouse_export';
import { logger } from '../logger';
import { config } from '../config';

let timer: ReturnType<typeof setInterval> | null = null;

export function startWarehouseExportJob(opts: {
  intervalMs?: number;
  bucket?: string;
  region?: string;
  alertWebhook?: string;
}): void {
  const bucket = opts.bucket || config.backup.bucket;
  const intervalMs = opts.intervalMs ?? 60 * 60 * 1000;

  const s3 = new S3Client({ region: opts.region || config.aws.region });
  const pipeline = new WarehouseExportPipeline({
    s3Client: s3,
    bucket,
    alertWebhook: opts.alertWebhook || config.backup.alertWebhookUrl,
  });

  const run = async () => {
    try {
      const result = await pipeline.run();
      logger.info('[warehouse-job] Export completed', result);
    } catch (err) {
      logger.error('[warehouse-job] Export failed', err);
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
