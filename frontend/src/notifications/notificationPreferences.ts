/**
 * notificationPreferences.ts
 *
 * Stores and retrieves the user's notification opt-in preference.
 * Backed by localStorage so the preference survives page reloads.
 *
 * Usage:
 *   setNotificationsEnabled(true)   // user toggles on
 *   isNotificationsEnabled()        // read current preference
 */

const PREF_KEY = 'stellar_save_notifications_enabled';

/**
 * Returns true if the user has opted in to notifications.
 * Defaults to true (opt-in by default on first connect).
 */
export function isNotificationsEnabled(): boolean {
  const stored = localStorage.getItem(PREF_KEY);
  // Default to enabled if no preference has been saved yet
  return stored === null ? true : stored === 'true';
}

/**
 * Persists the user's notification preference.
 */
export function setNotificationsEnabled(enabled: boolean): void {
  localStorage.setItem(PREF_KEY, String(enabled));
}
