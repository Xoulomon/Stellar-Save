import webpush from 'web-push';
import { PrismaClient } from './generated/prisma/client';
import { logger } from './logger';

export interface WebPushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
}

export class WebPushService {
  private prisma: PrismaClient;
  private enabled: boolean;

  constructor() {
    this.prisma = new (PrismaClient as any)();

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:noreply@stellar-save.com';

    if (!publicKey || !privateKey) {
      logger.warn('VAPID keys not configured — web push disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.');
      this.enabled = false;
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.enabled = true;
    logger.info('WebPushService initialized with VAPID keys');
  }

  getVapidPublicKey(): string {
    return process.env.VAPID_PUBLIC_KEY || '';
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async saveSubscription(userId: string, subscription: WebPushSubscriptionInput): Promise<void> {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
    logger.info('Push subscription saved', { userId });
  }

  async deleteSubscription(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    logger.info('Push subscription deleted', { endpoint });
  }

  async deleteSubscriptionsForUser(userId: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId } });
  }

  // Send to all subscriptions belonging to a specific user
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    await Promise.allSettled(subs.map(sub => this.sendToSubscription(sub, payload)));
  }

  // Send to all stored subscriptions (broadcast)
  async sendToAll(payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subs = await this.prisma.pushSubscription.findMany();
    await Promise.allSettled(subs.map(sub => this.sendToSubscription(sub, payload)));
  }

  // Send to users whose userId matches any of the given wallet addresses
  async sendToMembers(memberAddresses: string[], payload: PushPayload): Promise<void> {
    if (!this.enabled || memberAddresses.length === 0) return;

    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: memberAddresses } },
    });

    if (subs.length === 0) {
      // No direct address match — fall back to broadcast so no event is silently dropped
      logger.info('No subscriptions matched member addresses, broadcasting push', { memberAddresses });
      await this.sendToAll(payload);
      return;
    }

    await Promise.allSettled(subs.map(sub => this.sendToSubscription(sub, payload)));
  }

  private async sendToSubscription(
    sub: { endpoint: string; p256dh: string; auth: string },
    payload: PushPayload
  ): Promise<void> {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription has expired or been revoked — clean it up
        await this.prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } }).catch(() => {});
        logger.info('Removed expired push subscription', { endpoint: sub.endpoint });
      } else {
        logger.error('Failed to send push notification', { endpoint: sub.endpoint, error: String(err) });
      }
    }
  }
}
