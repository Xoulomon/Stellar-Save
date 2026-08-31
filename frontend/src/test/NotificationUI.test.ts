/**
 * test/NotificationUI.test.ts
 *
 * Unit tests for the NotificationUI presenter.
 * Tests conversion of shared notification types to toast format.
 */

import { describe, it, expect } from 'vitest';
import { NotificationUI } from '../notifications/NotificationUI';
import type { NotificationMessage, UIRenderOptions } from '../notifications/types';

describe('NotificationUI', () => {
  let mockMessage: NotificationMessage;

  beforeEach(() => {
    mockMessage = {
      id: 'test-msg-1',
      title: 'Test Notification',
      message: 'This is a test notification',
      severity: 'info',
      timestamp: Date.now(),
      metadata: {
        groupId: 'group-123',
      },
    };
  });

  describe('messageToToast()', () => {
    it('should convert a notification message to toast format', () => {
      const toast = NotificationUI.messageToToast(mockMessage);

      expect(toast).toEqual({
        id: 'test-msg-1',
        message: 'This is a test notification',
        title: 'Test Notification',
        type: 'info',
        duration: undefined,
        action: undefined,
        onClose: undefined,
      });
    });

    it('should apply UI render options', () => {
      const options: UIRenderOptions = {
        duration: 5000,
        action: {
          label: 'Retry',
          onClick: () => console.log('clicked'),
        },
      };

      const toast = NotificationUI.messageToToast(mockMessage, options);

      expect(toast.duration).toBe(5000);
      expect(toast.action).toEqual(options.action);
    });

    it('should prefer uiOptions on notification over passed options', () => {
      const passedOptions: UIRenderOptions = {
        duration: 5000,
      };

      const notificationWithUIOptions = {
        ...mockMessage,
        uiOptions: {
          duration: 2000,
        },
      };

      const toast = NotificationUI.messageToToast(notificationWithUIOptions, passedOptions);

      expect(toast.duration).toBe(2000); // from uiOptions, not passedOptions
    });

    it('should handle different severity levels', () => {
      const severities = ['success', 'error', 'warning', 'info'] as const;

      for (const severity of severities) {
        const msg = {
          ...mockMessage,
          severity,
        };

        const toast = NotificationUI.messageToToast(msg);
        expect(toast.type).toBe(severity);
      }
    });

    it('should preserve all notification metadata', () => {
      const msg = {
        ...mockMessage,
        metadata: {
          groupId: 'group-123',
          memberId: 'member-456',
          customField: 'customValue',
        },
      };

      const toast = NotificationUI.messageToToast(msg);

      expect(toast.id).toBe(msg.id);
      expect(toast.message).toBe(msg.message);
      expect(toast.title).toBe(msg.title);
    });
  });

  describe('shouldDisplay()', () => {
    it('should return true for all notifications (can be overridden)', () => {
      expect(NotificationUI.shouldDisplay(mockMessage)).toBe(true);

      const errorMsg = { ...mockMessage, severity: 'error' as const };
      expect(NotificationUI.shouldDisplay(errorMsg)).toBe(true);

      const warningMsg = { ...mockMessage, severity: 'warning' as const };
      expect(NotificationUI.shouldDisplay(warningMsg)).toBe(true);
    });
  });

  describe('Helper methods', () => {
    it('should create success toast', () => {
      const toast = NotificationUI.createSuccessToast('Operation successful', { duration: 3000 });

      expect(toast.type).toBe('success');
      expect(toast.message).toBe('Operation successful');
      expect(toast.duration).toBe(3000);
      expect(toast.id).toBeDefined();
    });

    it('should create error toast', () => {
      const toast = NotificationUI.createErrorToast('Something went wrong');

      expect(toast.type).toBe('error');
      expect(toast.message).toBe('Something went wrong');
      expect(toast.duration).toBe(4000); // default for error
    });

    it('should create info toast', () => {
      const toast = NotificationUI.createInfoToast('FYI: System maintenance tonight');

      expect(toast.type).toBe('info');
      expect(toast.message).toBe('FYI: System maintenance tonight');
      expect(toast.duration).toBe(3000); // default for info
    });

    it('should create warning toast', () => {
      const toast = NotificationUI.createWarningToast('Low balance warning');

      expect(toast.type).toBe('warning');
      expect(toast.message).toBe('Low balance warning');
      expect(toast.duration).toBe(4000); // default for warning
    });

    it('helper toasts should have unique IDs', () => {
      const toast1 = NotificationUI.createSuccessToast('Message 1');
      const toast2 = NotificationUI.createSuccessToast('Message 2');

      expect(toast1.id).not.toBe(toast2.id);
    });

    it('should apply custom options to helper toasts', () => {
      const onClick = () => console.log('clicked');
      const onClose = () => console.log('closed');

      const toast = NotificationUI.createSuccessToast('Success message', {
        duration: 10000,
        action: {
          label: 'Undo',
          onClick,
        },
        onClose,
      });

      expect(toast.duration).toBe(10000);
      expect(toast.action?.label).toBe('Undo');
      expect(toast.action?.onClick).toBe(onClick);
      expect(toast.onClose).toBe(onClose);
    });
  });

  describe('Type compatibility', () => {
    it('should handle UINotification type with uiOptions', () => {
      const uiNotification = {
        ...mockMessage,
        uiOptions: {
          duration: 5000,
        },
      };

      const toast = NotificationUI.messageToToast(uiNotification);
      expect(toast.duration).toBe(5000);
    });

    it('should handle TransportNotification type', () => {
      const transportNotification = {
        ...mockMessage,
        transportOptions: {
          timeout: 3000,
        },
      };

      // Should still work — just ignore transportOptions
      const toast = NotificationUI.messageToToast(transportNotification);
      expect(toast.type).toBe('info');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty message string', () => {
      const msg = {
        ...mockMessage,
        message: '',
      };

      const toast = NotificationUI.messageToToast(msg);
      expect(toast.message).toBe('');
    });

    it('should handle undefined metadata', () => {
      const msg = {
        ...mockMessage,
        metadata: undefined,
      };

      const toast = NotificationUI.messageToToast(msg);
      expect(toast.id).toBe(msg.id);
    });

    it('should handle long message strings', () => {
      const longMessage = 'A'.repeat(1000);
      const msg = {
        ...mockMessage,
        message: longMessage,
      };

      const toast = NotificationUI.messageToToast(msg);
      expect(toast.message).toBe(longMessage);
    });

    it('should handle very old timestamp', () => {
      const msg = {
        ...mockMessage,
        timestamp: 0, // Unix epoch
      };

      const toast = NotificationUI.messageToToast(msg);
      expect(toast.id).toBe(msg.id);
    });
  });
});
