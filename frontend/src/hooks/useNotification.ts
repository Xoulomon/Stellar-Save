import { useCallback } from 'react';

import { useToast } from '../components/Toast/useToast';

import type { Toast, ToastAction, ToastType } from '../components/Toast/types';
import { NotificationUI } from '../notifications/NotificationUI';
import type { NotificationMessage, UIRenderOptions } from '../notifications/types';

export interface NotificationOptions {
  duration?: number;
  action?: ToastAction;
  onClose?: () => void;
}

export interface NotifyOptions extends NotificationOptions {
  message: string;
  type?: ToastType;
}

export interface UseNotificationReturn {
  notifications: Toast[];
  queue: Toast[];
  notify: (options: NotifyOptions) => string;
  success: (message: string, options?: NotificationOptions) => string;
  error: (message: string, options?: NotificationOptions) => string;
  info: (message: string, options?: NotificationOptions) => string;
  dismiss: (id: string) => void;
  /**
   * Show a notification using the shared NotificationMessage type.
   * Bridges the shared notification system to the UI layer.
   */
  showNotification: (notification: NotificationMessage, uiOptions?: UIRenderOptions) => string;
}

export function useNotification(): UseNotificationReturn {
  const { addToast, removeToast, toasts, queue } = useToast();

  const notify = useCallback(
    ({ type = 'info', ...options }: NotifyOptions) =>
      addToast({
        ...options,
        type,
      }),
    [addToast]
  );

  const success = useCallback(
    (message: string, options?: NotificationOptions) =>
      notify({
        message,
        type: 'success',
        ...options,
      }),
    [notify]
  );

  const error = useCallback(
    (message: string, options?: NotificationOptions) =>
      notify({
        message,
        type: 'error',
        ...options,
      }),
    [notify]
  );

  const info = useCallback(
    (message: string, options?: NotificationOptions) =>
      notify({
        message,
        type: 'info',
        ...options,
      }),
    [notify]
  );

  const dismiss = useCallback(
    (id: string) => {
      removeToast(id);
    },
    [removeToast]
  );

  const showNotification = useCallback(
    (notification: NotificationMessage, uiOptions?: UIRenderOptions) => {
      const toast = NotificationUI.messageToToast(notification, uiOptions);
      return addToast({
        message: toast.message,
        type: toast.type,
        duration: toast.duration,
        action: toast.action,
        onClose: toast.onClose,
      });
    },
    [addToast]
  );

  return {
    notifications: toasts,
    queue,
    notify,
    success,
    error,
    info,
    dismiss,
    showNotification,
  };
}

export default useNotification;
