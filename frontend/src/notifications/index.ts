/**
 * notifications/index.ts — public barrel export
 */
export { requestNotificationPermission, getNotificationPermission, canShowNotifications } from './notificationPermission';
export type { NotificationPermissionStatus } from './notificationPermission';

export { registerServiceWorker, postToServiceWorker } from './serviceWorkerRegistration';

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
