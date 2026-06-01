// backend/src/modules/webhooks/webhook.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly webhookQueue: Queue;

  constructor(private configService: ConfigService) {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not defined');
    }

    this.webhookQueue = new Queue('webhook-delivery', {
      connection: new Redis(redisUrl),
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    });
  }

  async registerWebhook(userId: string, data: { url: string; events: string[]; secret?: string }) {
    const secret = data.secret || crypto.randomBytes(32).toString('hex');

    // TODO: Add Prisma later
    console.log(`Webhook registered for user ${userId}: ${data.url}`);
    return { id: 'temp-webhook-id', ...data, secret };
  }

  async getUserWebhooks(userId: string) {
    console.log(`Fetching webhooks for user ${userId}`);
    return [];
  }

  async deleteWebhook(userId: string, webhookId: string) {
    console.log(`Deleting webhook ${webhookId} for user ${userId}`);
    return { success: true };
  }

  async dispatchEvent(event: string, payload: any) {
    console.log(`Event dispatched: ${event}`, payload);
    // TODO: Implement real logic with Prisma later
  }
}