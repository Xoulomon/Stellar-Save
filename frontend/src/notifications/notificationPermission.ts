/**
 * notificationPermission.ts
 *
 * Handles requesting and checking browser notification permission.
 * Called once when the user connects their wallet.
 */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

/**
 * Returns the current notification permission state without prompting.
 */
export function getNotificationPermission(): NotificationPermissionStatus {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as NotificationPermissionStatus;
}

/**
 * Requests notification permission from the browser.
 * Must be called from a user-gesture context (e.g. wallet connect button click).
 *
 * @returns The resulting permission status.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!('Notification' in window)) {
    console.warn('[Notifications] Web Notifications API not supported in this browser.');
    return 'unsupported';
  }

  // Already decided — don't prompt again
  if (Notification.permission !== 'default') {
    return Notification.permission as NotificationPermissionStatus;
  }

  try {
    const result = await Notification.requestPermission();
    return result as NotificationPermissionStatus;
  } catch (err) {
    console.error('[Notifications] Permission request failed:', err);
    return 'denied';
  }
}

/**
 * Returns true only when notifications are fully usable.
 */
export function canShowNotifications(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}
