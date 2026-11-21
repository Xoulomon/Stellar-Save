import webpush from 'web-push';

import { config } from './config';
import { PrismaClient } from './generated/prisma/client';
import { logger } from './logger';
import { prisma } from './prisma_client';

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

/**
 * Web Push service for sending browser push notifications.
 *
 * Refactored for dependency injection (Issue #1701):
 * - PrismaClient, config, and logger are accepted via constructor
 * - Tests inject mocks instead of hitting a real DB
 */

export interface WebPushServiceDeps {
  db?: PrismaClient;
  config?: { vapid: { publicKey: string; privateKey: string; subject: string } };
  logger?: { info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void };
}

export class WebPushService {
  private prisma: PrismaClient;
  private enabled: boolean;
  private readonly log: NonNullable<WebPushServiceDeps['logger']>;
  private vapidPublicKey: string;

  constructor(deps?: WebPushServiceDeps) {
    this.prisma = deps?.db ?? prisma;
    this.log = deps?.logger ?? logger;

    const resolvedConfig = deps?.config ?? config;
    const publicKey = resolvedConfig.vapid.publicKey;
    const privateKey = resolvedConfig.vapid.privateKey;
    const subject = resolvedConfig.vapid.subject;
    this.vapidPublicKey = publicKey;

    if (!publicKey || !privateKey) {
      this.log.warn(
        'VAPID keys not configured — web push disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.'
      );
      this.enabled = false;
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.enabled = true;
    this.log.info('WebPushService initialized with VAPID keys');
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
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
    this.log.info('Push subscription saved', { userId });
  }

  async deleteSubscription(endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    this.log.info('Push subscription deleted', { endpoint });
  }

  async deleteSubscriptionsForUser(userId: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId } });
  }

  // Send to all subscriptions belonging to a specific user
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subs = await this.prisma.pushSubscription.findMany({ where: { userId } });
    await Promise.allSettled(subs.map((sub) => this.sendToSubscription(sub, payload)));
  }

  // Send to all stored subscriptions (broadcast)
  async sendToAll(payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subs = await this.prisma.pushSubscription.findMany();
    await Promise.allSettled(subs.map((sub) => this.sendToSubscription(sub, payload)));
  }

  // Send to users whose userId matches any of the given wallet addresses
  async sendToMembers(memberAddresses: string[], payload: PushPayload): Promise<void> {
    if (!this.enabled || memberAddresses.length === 0) return;

    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId: { in: memberAddresses } },
    });

    if (subs.length === 0) {
      // No direct address match — fall back to broadcast so no event is silently dropped
      this.log.info('No subscriptions matched member addresses, broadcasting push', {
        memberAddresses,
      });
      await this.sendToAll(payload);
      return;
    }

    await Promise.allSettled(subs.map((sub) => this.sendToSubscription(sub, payload)));
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
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        // Subscription has expired or been revoked — clean it up
        await this.prisma.pushSubscription
          .deleteMany({ where: { endpoint: sub.endpoint } })
          .catch(() => {});
        this.log.info('Removed expired push subscription', { endpoint: sub.endpoint });
      } else {
        this.log.error('Failed to send push notification', {
          endpoint: sub.endpoint,
          error: String(err),
        });
      }
    }
  }
}
