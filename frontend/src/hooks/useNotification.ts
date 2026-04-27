import { useCallback } from 'react';
import { useToast } from '../components/Toast/useToast';
import type { Toast, ToastAction, ToastType } from '../components/Toast/types';

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
}

export function useNotification(): UseNotificationReturn {
  const { addToast, removeToast, toasts, queue } = useToast();

  const notify = useCallback(
    ({ type = 'info', ...options }: NotifyOptions) => addToast({
      ...options,
      type,
    }),
    [addToast],
  );

  const success = useCallback(
    (message: string, options?: NotificationOptions) => notify({
      message,
      type: 'success',
      ...options,
    }),
    [notify],
  );

  const error = useCallback(
    (message: string, options?: NotificationOptions) => notify({
      message,
      type: 'error',
      ...options,
    }),
    [notify],
  );

  const info = useCallback(
    (message: string, options?: NotificationOptions) => notify({
      message,
      type: 'info',
      ...options,
    }),
    [notify],
  );

  const dismiss = useCallback((id: string) => {
    removeToast(id);
  }, [removeToast]);

  return {
    notifications: toasts,
    queue,
    notify,
    success,
    error,
    info,
    dismiss,
  };
}

export default useNotification;