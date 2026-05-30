/**
 * reminderPreferences.ts
 *
 * Manages user preferences for contribution reminders.
 * Stores timing preferences, notification channels, and quiet hours.
 * All data persists in localStorage.
 */

export type ReminderTiming = '24h' | '12h' | '1h';
export type NotificationChannel = 'browser' | 'email';

export interface QuietHours {
  enabled: boolean;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
}

export interface ReminderPreferences {
  enabled: boolean;
  timing: ReminderTiming;
  channels: NotificationChannel[];
  quietHours: QuietHours;
}

const STORAGE_KEY = 'stellar_save_reminder_preferences';

const DEFAULT_PREFERENCES: ReminderPreferences = {
  enabled: true,
  timing: '24h',
  channels: ['browser'],
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
};

/**
 * Retrieve saved reminder preferences from localStorage.
 * Returns defaults if none exist.
 */
export function getReminderPreferences(): ReminderPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_PREFERENCES;
    }
    const parsed = JSON.parse(stored) as ReminderPreferences;
    // Merge with defaults to handle missing keys from older versions
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      quietHours: {
        ...DEFAULT_PREFERENCES.quietHours,
        ...parsed.quietHours,
      },
    };
  } catch (error) {
    console.warn('Failed to parse reminder preferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Save reminder preferences to localStorage.
 */
export function setReminderPreferences(preferences: ReminderPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    // Dispatch custom event for other parts of app to react to changes
    window.dispatchEvent(
      new CustomEvent('reminder-preferences-changed', { detail: preferences })
    );
  } catch (error) {
    console.error('Failed to save reminder preferences:', error);
  }
}

/**
 * Check if a reminder should be shown based on quiet hours.
 */
export function isWithinQuietHours(preferences: ReminderPreferences): boolean {
  if (!preferences.quietHours.enabled) {
    return false;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  const { startTime, endTime } = preferences.quietHours;

  // Handle case where quiet hours span midnight (e.g., 22:00 to 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  // Normal case (e.g., 14:00 to 18:00)
  return currentTime >= startTime && currentTime < endTime;
}

/**
 * Reset preferences to defaults.
 */
export function resetReminderPreferences(): void {
  setReminderPreferences(DEFAULT_PREFERENCES);
}
