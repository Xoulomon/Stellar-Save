/**
 * notifications/NotificationTransport.ts
 *
 * Decoupled transport layer for push and webhook delivery.
 * Handles the mechanism of sending notifications without coupling
 * to the presentation layer.
 *
 * This module is responsible for:
 * - Sending browser push notifications via the service worker
 * - Delivering webhooks to external endpoints
 * - Email delivery (backend integration)
 * - Retry logic and error handling
 */

import { postToServiceWorker } from './serviceWorkerRegistration';
import { canShowNotifications } from './notificationPermission';
import type {
  TransportNotification,
  DeliveryChannel,
  DeliveryResult,
  DeliveryCallback,
} from './types';

/**
 * NotificationTransport handles delivery of notifications across
 * different channels (browser push, email, webhook).
 */
export class NotificationTransport {
  private deliveryCallbacks: Map<string, DeliveryCallback[]> = new Map();

  /**
   * Send a notification across specified delivery channels.
   * Returns a promise that resolves when all delivery attempts complete.
   *
   * @param notification - The message to deliver
   * @param channels - Channels to send through; defaults to ['browser']
   * @param onDelivery - Optional callback fired for each channel's result
   */
  async send(
    notification: TransportNotification,
    channels: DeliveryChannel[] = ['browser'],
    onDelivery?: DeliveryCallback,
  ): Promise<DeliveryResult[]> {
    const results: DeliveryResult[] = [];

    for (const channel of channels) {
      try {
        const result = await this.deliverToChannel(notification, channel);
        results.push(result);

        if (onDelivery) {
          onDelivery(result);
        }

        this.notifyCallbacks(notification.id, result);
      } catch (error) {
        const result: DeliveryResult = {
          success: false,
          channel,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        };

        results.push(result);

        if (onDelivery) {
          onDelivery(result);
        }

        this.notifyCallbacks(notification.id, result);
      }
    }

    return results;
  }

  /**
   * Register a callback to listen for delivery results.
   */
  onDelivery(notificationId: string, callback: DeliveryCallback): void {
    if (!this.deliveryCallbacks.has(notificationId)) {
      this.deliveryCallbacks.set(notificationId, []);
    }
    this.deliveryCallbacks.get(notificationId)!.push(callback);
  }

  /**
   * Unregister a delivery callback.
   */
  offDelivery(notificationId: string, callback: DeliveryCallback): void {
    const callbacks = this.deliveryCallbacks.get(notificationId);
    if (!callbacks) return;

    const idx = callbacks.indexOf(callback);
    if (idx !== -1) {
      callbacks.splice(idx, 1);
    }

    if (callbacks.length === 0) {
      this.deliveryCallbacks.delete(notificationId);
    }
  }

  /**
   * Deliver to a single channel.
   * @private
   */
  private async deliverToChannel(
    notification: TransportNotification,
    channel: DeliveryChannel,
  ): Promise<DeliveryResult> {
    const timestamp = Date.now();

    switch (channel) {
      case 'browser':
        return this.deliverBrowserPush(notification, timestamp);
      case 'email':
        return this.deliverEmail(notification, timestamp);
      case 'webhook':
        return this.deliverWebhook(notification, timestamp);
      default:
        throw new Error(`Unknown delivery channel: ${channel}`);
    }
  }

  /**
   * Deliver via browser push notification.
   * @private
   */
  private async deliverBrowserPush(
    notification: TransportNotification,
    timestamp: number,
  ): Promise<DeliveryResult> {
    if (!canShowNotifications()) {
      return {
        success: false,
        channel: 'browser',
        error: 'Browser notifications not permitted',
        timestamp,
      };
    }

    try {
      await postToServiceWorker({
        type: 'SHOW_NOTIFICATION',
        title: notification.title,
        body: notification.message,
        id: notification.id,
        metadata: notification.metadata,
      });

      return {
        success: true,
        channel: 'browser',
        timestamp,
      };
    } catch (error) {
      throw new Error(`Failed to send browser push: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deliver via email (backend integration).
   * @private
   */
  private async deliverEmail(
    notification: TransportNotification,
    timestamp: number,
  ): Promise<DeliveryResult> {
    // Email delivery is typically handled by a backend service.
    // This method would queue the notification for backend processing.
    const options = notification.transportOptions || {};
    const endpoint = options.endpoint || '/api/v1/notifications/email';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notification.title,
          message: notification.message,
          severity: notification.severity,
          metadata: notification.metadata,
        }),
      });

      if (!res.ok) {
        throw new Error(`Email delivery failed: ${res.statusText}`);
      }

      return {
        success: true,
        channel: 'email',
        timestamp,
      };
    } catch (error) {
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deliver via webhook to an external endpoint.
   * @private
   */
  private async deliverWebhook(
    notification: TransportNotification,
    timestamp: number,
  ): Promise<DeliveryResult> {
    const options = notification.transportOptions || {};
    const endpoint = options.endpoint;
    const timeout = options.timeout || 5000;

    if (!endpoint) {
      throw new Error('Webhook endpoint not specified');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: notification.id,
          title: notification.title,
          message: notification.message,
          severity: notification.severity,
          timestamp: notification.timestamp,
          metadata: notification.metadata,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Webhook failed: ${res.statusText}`);
      }

      return {
        success: true,
        channel: 'webhook',
        timestamp,
      };
    } catch (error) {
      throw new Error(
        `Failed to deliver webhook: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Notify all registered callbacks for a notification.
   * @private
   */
  private notifyCallbacks(notificationId: string, result: DeliveryResult): void {
    const callbacks = this.deliveryCallbacks.get(notificationId);
    if (!callbacks) return;

    callbacks.forEach((cb) => {
      try {
        cb(result);
      } catch (error) {
        console.error('[Transport] Callback error:', error);
      }
    });
  }
}

// Export singleton instance
export const notificationTransport = new NotificationTransport();

// Export for testing/di
export { NotificationTransport };
