/**
 * Toast types — UI presentation layer.
 * These types align with the shared NotificationSeverity from notifications/types.ts
 */

import type { NotificationSeverity } from '../../notifications/types';

export type ToastType = NotificationSeverity;

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number; // milliseconds, undefined = no auto-dismiss
  action?: ToastAction;
  onClose?: () => void;
}

export interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  toasts: Toast[];
  queue: Toast[];
}
