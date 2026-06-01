// backend/src/modules/webhooks/webhook.worker.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import axios from 'axios';

@Processor('webhook-delivery')
export class WebhookWorker extends WorkerHost {
  private readonly logger = new Logger(WebhookWorker.name);

  async process(job: Job) {
    const { url, payload } = job.data;

    try {
      await axios.post(url, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': payload.signature,
          'X-Webhook-Timestamp': payload.timestamp,
        },
      });

      this.logger.log(`Webhook delivered successfully to ${url}`);
    } catch (error: any) {
      this.logger.error(`Webhook delivery failed to ${url}: ${error.message}`);
      throw error; // BullMQ will retry
    }
  }
}