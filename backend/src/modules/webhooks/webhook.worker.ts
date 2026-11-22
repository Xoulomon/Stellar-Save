import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { withRetry } from '@stellar-save/shared-utils';
import axios from 'axios';

import { webhookRetryPolicy } from '../../lib/retry_policies';

import type { Job } from 'bullmq';

@Processor('webhook-delivery')
export class WebhookWorker extends WorkerHost {
  private readonly logger = new Logger(WebhookWorker.name);

  async process(job: Job) {
    const { url, payload } = job.data;

    try {
      await withRetry(async () => {
        return await axios.post(url, payload, {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': payload.signature,
            'X-Webhook-Timestamp': payload.timestamp,
          },
        });
      }, webhookRetryPolicy);

      this.logger.log(`Webhook delivered successfully to ${url}`);
    } catch (error: unknown) {
      this.logger.error(
        `Webhook delivery failed to ${url}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error; // BullMQ will retry
    }
  }
}
