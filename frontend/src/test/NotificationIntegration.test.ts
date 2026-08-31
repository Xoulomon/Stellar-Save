/**
 * test/NotificationIntegration.test.ts
 *
 * Integration tests for the notification system.
 * Tests that transport and UI layers work together correctly.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationTransport } from '../notifications/NotificationTransport';
import { NotificationUI } from '../notifications/NotificationUI';
import type { NotificationMessage, TransportNotification, DeliveryChannel } from '../notifications/types';
import * as notificationPermission from '../notifications/notificationPermission';
import * as swRegistration from '../notifications/serviceWorkerRegistration';

vi.mock('../notifications/notificationPermission');
vi.mock('../notifications/serviceWorkerRegistration');

describe('Notification System Integration', () => {
  let transport: NotificationTransport;
  let mockMessage: NotificationMessage;

  beforeEach(() => {
    transport = new NotificationTransport();
    mockMessage = {
      id: 'integration-test-1',
      title: 'Integration Test Notification',
      message: 'This is an integration test notification',
      severity: 'success',
      timestamp: Date.now(),
      metadata: {
        groupId: 'group-123',
        actionType: 'contribution',
      },
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Full notification flow', () => {
    it('should deliver via transport and render via UI', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      // Step 1: Send via transport
      const deliveryResults = await transport.send(mockMessage, ['browser']);

      expect(deliveryResults[0].success).toBe(true);
      expect(deliveryResults[0].channel).toBe('browser');

      // Step 2: Convert to toast via UI
      const toast = NotificationUI.messageToToast(mockMessage);

      expect(toast.type).toBe('success');
      expect(toast.message).toBe(mockMessage.message);
      expect(toast.title).toBe(mockMessage.title);
    });

    it('should handle multi-channel delivery with UI conversion', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
      });

      const channels: DeliveryChannel[] = ['browser', 'email'];

      // Deliver via multiple channels
      const deliveryResults = await transport.send(mockMessage, channels);

      expect(deliveryResults).toHaveLength(2);
      expect(deliveryResults.every((r) => r.success)).toBe(true);

      // Convert to toast for UI rendering
      const toast = NotificationUI.messageToToast(mockMessage);

      expect(toast.id).toBe(mockMessage.id);
    });

    it('should track delivery with UI updates via callbacks', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      const deliveryTracker: string[] = [];

      const callback = (result: any) => {
        deliveryTracker.push(`${result.channel}:${result.success ? 'ok' : 'fail'}`);
      };

      transport.onDelivery(mockMessage.id, callback);

      // Deliver notification
      await transport.send(mockMessage, ['browser'], callback);

      // UI can react to delivery status
      const toast = NotificationUI.messageToToast(mockMessage);

      expect(deliveryTracker).toContain('browser:ok');
      expect(toast.type).toBe('success');
    });
  });

  describe('Notification with UI options end-to-end', () => {
    it('should render notification with custom UI options after transport delivery', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      const uiNotification = {
        ...mockMessage,
        uiOptions: {
          duration: 5000,
          action: {
            label: 'View Details',
            onClick: () => console.log('clicked'),
          },
        },
      };

      // Deliver via transport
      const deliveryResults = await transport.send(uiNotification as TransportNotification, [
        'browser',
      ]);

      expect(deliveryResults[0].success).toBe(true);

      // Convert to toast with UI options
      const toast = NotificationUI.messageToToast(uiNotification);

      expect(toast.duration).toBe(5000);
      expect(toast.action?.label).toBe('View Details');
    });
  });

  describe('Error handling across layers', () => {
    it('should handle transport failure gracefully for UI', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(false);

      // Transport fails
      const deliveryResults = await transport.send(mockMessage, ['browser']);
      expect(deliveryResults[0].success).toBe(false);

      // UI should still be able to render (fallback notification)
      const toast = NotificationUI.createErrorToast('Failed to deliver notification');

      expect(toast.type).toBe('error');
      expect(toast.message).toBe('Failed to deliver notification');
    });

    it('should handle partial channel failures', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(false);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        statusText: 'OK',
      });

      // Send to multiple channels (browser fails, email succeeds)
      const deliveryResults = await transport.send(mockMessage, ['browser', 'email']);

      expect(deliveryResults[0].success).toBe(false); // browser
      expect(deliveryResults[1].success).toBe(true); // email

      // UI can display the message regardless
      const toast = NotificationUI.messageToToast(mockMessage);
      expect(toast.id).toBe(mockMessage.id);
    });
  });

  describe('Notification lifecycle', () => {
    it('should support complete notification lifecycle', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      const stages: string[] = [];

      // 1. Create notification
      stages.push('created');

      // 2. Register delivery callback
      transport.onDelivery(mockMessage.id, (result) => {
        stages.push(`delivered:${result.channel}`);
      });

      // 3. Send via transport
      const deliveryResults = await transport.send(mockMessage, ['browser']);
      expect(deliveryResults[0].success).toBe(true);

      // 4. Convert to UI format
      const toast = NotificationUI.messageToToast(mockMessage, {
        onClose: () => {
          stages.push('dismissed');
        },
      });

      // 5. Call onClose (simulating dismissal)
      toast.onClose?.();

      expect(stages).toEqual(['created', 'delivered:browser', 'dismissed']);
    });

    it('should support bulk notifications with transport and UI', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      const notifications: NotificationMessage[] = [
        { ...mockMessage, id: 'notif-1', message: 'Message 1' },
        { ...mockMessage, id: 'notif-2', message: 'Message 2', severity: 'error' },
        { ...mockMessage, id: 'notif-3', message: 'Message 3', severity: 'warning' },
      ];

      // Deliver all via transport
      const deliveryResults = await Promise.all(
        notifications.map((n) => transport.send(n, ['browser'])),
      );

      expect(deliveryResults).toHaveLength(3);
      expect(deliveryResults.every((r) => r[0]?.success)).toBe(true);

      // Convert all to toasts
      const toasts = notifications.map((n) => NotificationUI.messageToToast(n));

      expect(toasts).toHaveLength(3);
      expect(toasts[0].type).toBe('success');
      expect(toasts[1].type).toBe('error');
      expect(toasts[2].type).toBe('warning');
    });
  });

  describe('Type safety', () => {
    it('should maintain type safety through transport and UI layers', async () => {
      vi.mocked(notificationPermission.canShowNotifications).mockReturnValue(true);
      vi.mocked(swRegistration.postToServiceWorker).mockResolvedValue(undefined);

      // Create a notification with specific types
      const typedNotification: NotificationMessage = {
        id: 'typed-1',
        title: 'Type Safe',
        message: 'This is type safe',
        severity: 'info',
        timestamp: Date.now(),
      };

      // Send via transport (should not have typing errors)
      await transport.send(typedNotification, ['browser']);

      // Convert via UI (should not have typing errors)
      const toast = NotificationUI.messageToToast(typedNotification);

      // Verify toast has correct types
      expect(toast.type).toBe('info');
      expect(typeof toast.message).toBe('string');
    });
  });
});
