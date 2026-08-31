import { S3Client } from '@aws-sdk/client-s3';
import { WarehouseExportPipeline } from '../../warehouse_export';
import { logger } from '../../logger';

export class WarehouseHandler {
  private pipeline: WarehouseExportPipeline;

  constructor(opts: {
    s3Client?: S3Client;
    bucket: string;
    alertWebhook?: string;
  }) {
    this.pipeline = new WarehouseExportPipeline({
      s3Client: opts.s3Client,
      bucket: opts.bucket,
      alertWebhook: opts.alertWebhook,
    });
  }

  async execute(): Promise<any> {
    try {
      const result = await this.pipeline.run();
      logger.info('[warehouse] Export completed', result);
      return result;
    } catch (err) {
      logger.error('[warehouse] Export failed', err);
      throw err;
    }
  }
}
