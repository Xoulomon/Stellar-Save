/**
 * test/NotificationTransport.test.ts
 *
 * Unit tests for the NotificationTransport module.
 * Tests browser push, email, and webhook delivery channels.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationTransport } from '../notifications/NotificationTransport';
import * as notificationPermission from '../notifications/notificationPermission';
import * as swRegistration from '../notifications/serviceWorkerRegistration';
import type { TransportNotification, DeliveryCallback } from '../notifications/types';

// Mock the browser API modules
vi.mock('../notifications/notificationPermission');
vi.mock('../notifications/serviceWorkerRegistration');

describe('NotificationTransport', () => {
  let transport: NotificationTransport;
  let mockNotification: TransportNotification;

  beforeEach(() => {
    transport = new NotificationTransport();
    mockNotification = {
      id: 'test-notification-1',
      title: 'Test Title',
      message: 'Test message',
      severity: 'info',
      timestamp: Date.now(),
      metadata: {
        groupId: 'group-123',
      },
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('send()', () => {
    it('should deliver to browser channel when permitted', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      const results = await transport.send(mockNotification, ['browser']);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('browser');
      expect(swRegistration.postToServiceWorker).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SHOW_NOTIFICATION',
          title: 'Test Title',
          body: 'Test message',
          id: 'test-notification-1',
        }),
      );
    });

    it('should fail when browser notifications are not permitted', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(false);

      const results = await transport.send(mockNotification, ['browser']);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].channel).toBe('browser');
      expect(results[0].error).toContain('not permitted');
    });

    it('should handle multiple delivery channels', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
      });

      const results = await transport.send(mockNotification, ['browser', 'email']);

      expect(results).toHaveLength(2);
      expect(results[0].channel).toBe('browser');
      expect(results[1].channel).toBe('email');
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should call delivery callbacks for each result', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      const callback = vi.fn() as DeliveryCallback;

      await transport.send(mockNotification, ['browser'], callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          channel: 'browser',
        }),
      );
    });

    it('should default to browser channel if none specified', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      const results = await transport.send(mockNotification);

      expect(results).toHaveLength(1);
      expect(results[0].channel).toBe('browser');
    });
  });

  describe('onDelivery()', () => {
    it('should register and call callbacks for notification delivery', async () => {
      const callback = vi.fn() as DeliveryCallback;
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      transport.onDelivery(mockNotification.id, callback);
      await transport.send(mockNotification, ['browser']);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          channel: 'browser',
        }),
      );
    });

    it('should call multiple registered callbacks', async () => {
      const callback1 = vi.fn() as DeliveryCallback;
      const callback2 = vi.fn() as DeliveryCallback;

      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      transport.onDelivery(mockNotification.id, callback1);
      transport.onDelivery(mockNotification.id, callback2);
      await transport.send(mockNotification, ['browser']);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('offDelivery()', () => {
    it('should unregister callbacks', async () => {
      const callback = vi.fn() as DeliveryCallback;
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      transport.onDelivery(mockNotification.id, callback);
      transport.offDelivery(mockNotification.id, callback);
      await transport.send(mockNotification, ['browser']);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Email delivery', () => {
    it('should post to email endpoint', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
      });

      const results = await transport.send(mockNotification, ['email']);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/notifications/email',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test Title'),
        }),
      );

      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('email');
    });

    it('should fail on email endpoint error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const results = await transport.send(mockNotification, ['email']);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Email delivery failed');
    });

    it('should use custom endpoint if provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
      });

      const notifWithCustomEndpoint: TransportNotification = {
        ...mockNotification,
        transportOptions: {
          endpoint: 'https://custom.endpoint.com/notify',
        },
      };

      await transport.send(notifWithCustomEndpoint, ['email']);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom.endpoint.com/notify',
        expect.any(Object),
      );
    });
  });

  describe('Webhook delivery', () => {
    it('should post to webhook endpoint', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
      });

      const notifWithWebhook: TransportNotification = {
        ...mockNotification,
        transportOptions: {
          endpoint: 'https://webhook.example.com/notifications',
        },
      };

      const results = await transport.send(notifWithWebhook, ['webhook']);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://webhook.example.com/notifications',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      expect(results[0].success).toBe(true);
      expect(results[0].channel).toBe('webhook');
    });

    it('should fail when webhook endpoint is missing', async () => {
      const results = await transport.send(mockNotification, ['webhook']);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('endpoint not specified');
    });

    it('should handle webhook timeout', async () => {
      vi.useFakeTimers();

      let abortCalled = false;
      global.fetch = vi.fn().mockImplementation(
        (_url, { signal }: { signal: AbortSignal }) => {
          signal.addEventListener('abort', () => {
            abortCalled = true;
          });

          return new Promise(() => {
            // Never resolves (simulating timeout)
          });
        },
      );

      const notifWithTimeout: TransportNotification = {
        ...mockNotification,
        transportOptions: {
          endpoint: 'https://webhook.example.com/notifications',
          timeout: 100,
        },
      };

      const promise = transport.send(notifWithTimeout, ['webhook']);
      vi.advanceTimersByTime(150);

      const results = await promise;

      expect(abortCalled).toBe(true);
      expect(results[0].success).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('Error handling', () => {
    it('should handle unknown delivery channel', async () => {
      const results = await transport.send(mockNotification, ['unknown' as any]);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Unknown delivery channel');
    });

    it('should continue on single channel failure in multi-channel delivery', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(false);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
      });

      const results = await transport.send(mockNotification, ['browser', 'email']);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(false); // browser fails
      expect(results[1].success).toBe(true); // email succeeds
    });

    it('should catch callback errors without breaking', async () => {
      const badCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });

      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      transport.onDelivery(mockNotification.id, badCallback);

      // Should not throw
      const results = await transport.send(mockNotification, ['browser']);

      expect(results[0].success).toBe(true);
      expect(badCallback).toHaveBeenCalled();
    });
  });
});
