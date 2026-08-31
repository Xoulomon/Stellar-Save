/**
 * notifications/NotificationUI.ts
 *
 * UI presentation layer for notifications (toast rendering).
 * Decoupled from transport — only handles how notifications are displayed.
 *
 * This module:
 * - Converts shared NotificationMessage to UI-specific Toast format
 * - Manages toast display lifecycle
 * - Handles toast queue and stacking
 */

import type { UINotification, NotificationMessage, UIRenderOptions } from './types';

/**
 * Toast format expected by the ToastProvider.
 * This is internal to the UI layer.
 */
export interface Toast {
  id: string;
  message: string;
  title?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
}

/**
 * Notification UI presenter converts shared types to toast format.
 */
export class NotificationUI {
  /**
   * Convert a shared notification message to toast format.
   * Applies UI-specific rendering options.
   */
  static messageToToast(
    notification: NotificationMessage | UINotification,
    renderOptions?: UIRenderOptions,
  ): Toast {
    const opts = (notification as UINotification).uiOptions || renderOptions;

    return {
      id: notification.id,
      message: notification.message,
      title: notification.title,
      type: notification.severity,
      duration: opts?.duration,
      action: opts?.action,
      onClose: opts?.onClose,
    };
  }

  /**
   * Check if a notification qualifies for UI display based on severity.
   * Can be used to filter which notifications should be shown in the UI.
   */
  static shouldDisplay(notification: NotificationMessage): boolean {
    // All notifications can be displayed; callers can add custom logic
    return true;
  }

  /**
   * Helper to create a success toast from a message.
   */
  static createSuccessToast(
    message: string,
    options?: UIRenderOptions,
  ): Toast {
    const id = `success-${Date.now()}-${Math.random()}`;
    return {
      id,
      message,
      type: 'success',
      duration: options?.duration ?? 3000,
      action: options?.action,
      onClose: options?.onClose,
    };
  }

  /**
   * Helper to create an error toast from a message.
   */
  static createErrorToast(
    message: string,
    options?: UIRenderOptions,
  ): Toast {
    const id = `error-${Date.now()}-${Math.random()}`;
    return {
      id,
      message,
      type: 'error',
      duration: options?.duration ?? 4000,
      action: options?.action,
      onClose: options?.onClose,
    };
  }

  /**
   * Helper to create an info toast from a message.
   */
  static createInfoToast(
    message: string,
    options?: UIRenderOptions,
  ): Toast {
    const id = `info-${Date.now()}-${Math.random()}`;
    return {
      id,
      message,
      type: 'info',
      duration: options?.duration ?? 3000,
      action: options?.action,
      onClose: options?.onClose,
    };
  }

  /**
   * Helper to create a warning toast from a message.
   */
  static createWarningToast(
    message: string,
    options?: UIRenderOptions,
  ): Toast {
    const id = `warning-${Date.now()}-${Math.random()}`;
    return {
      id,
      message,
      type: 'warning',
      duration: options?.duration ?? 4000,
      action: options?.action,
      onClose: options?.onClose,
    };
  }
}

export { Toast };
