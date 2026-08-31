/**
 * notifications/index.ts — public barrel export
 *
 * Exports shared types, transport, and UI modules for decoupled notification handling.
 */

// ─── Shared Types ──────────────────────────────────────────────────────────

export type {
  NotificationSeverity,
  DeliveryChannel,
  NotificationMessage,
  UIRenderOptions,
  TransportDeliveryOptions,
  UINotification,
  TransportNotification,
  DeliveryResult,
  DeliveryCallback,
} from './types';

// ─── Transport Layer ───────────────────────────────────────────────────────

export {
  NotificationTransport,
  notificationTransport,
} from './NotificationTransport';

// ─── UI Layer ──────────────────────────────────────────────────────────────

export {
  NotificationUI,
  type Toast as UIToast,
} from './NotificationUI';

// ─── Permissions & Service Worker ──────────────────────────────────────────

export { requestNotificationPermission, getNotificationPermission, canShowNotifications } from './notificationPermission';
export type { NotificationPermissionStatus } from './notificationPermission';

export { registerServiceWorker, postToServiceWorker } from './serviceWorkerRegistration';

// ─── Scheduling & Preferences ──────────────────────────────────────────────

export {
  scheduleContributionReminders,
  cancelGroupReminders,
  cancelAllReminders,
  getScheduledReminders,
} from './contributionScheduler';
export type { ContributionReminder } from './contributionScheduler';

export { isNotificationsEnabled, setNotificationsEnabled } from './notificationPreferences';

export {
  getReminderPreferences,
  setReminderPreferences,
  resetReminderPreferences,
  isWithinQuietHours,
} from './reminderPreferences';
export type { ReminderPreferences, ReminderTiming, NotificationChannel, QuietHours } from './reminderPreferences';
