import { useEffect, useState, useCallback } from 'react';
import {
  getReminderPreferences,
  setReminderPreferences,
  resetReminderPreferences,
  type ReminderPreferences,
  type ReminderTiming,
  type NotificationChannel,
} from '../notifications/reminderPreferences';

/**
 * Hook to access and manage reminder preferences.
 *
 * Automatically syncs with localStorage and handles
 * preference changes from other tabs/windows.
 *
 * @example
 * const { preferences, updateTiming, toggleChannel } = useReminderPreferences();
 */
export function useReminderPreferences() {
  const [preferences, setPreferences] = useState<ReminderPreferences>(() =>
    getReminderPreferences()
  );

  // Sync with localStorage changes from other tabs/windows
  useEffect(() => {
    const handlePreferencesChanged = (
      event: Event | CustomEvent<ReminderPreferences>
    ) => {
      if ('detail' in event) {
        setPreferences(event.detail);
      } else {
        setPreferences(getReminderPreferences());
      }
    };

    window.addEventListener(
      'reminder-preferences-changed',
      handlePreferencesChanged
    );
    window.addEventListener('storage', handlePreferencesChanged);

    return () => {
      window.removeEventListener(
        'reminder-preferences-changed',
        handlePreferencesChanged
      );
      window.removeEventListener('storage', handlePreferencesChanged);
    };
  }, []);

  const updatePreferences = useCallback((newPreferences: ReminderPreferences) => {
    setPreferences(newPreferences);
    setReminderPreferences(newPreferences);
  }, []);

  const toggleEnabled = useCallback((enabled: boolean) => {
    updatePreferences({
      ...preferences,
      enabled,
    });
  }, [preferences, updatePreferences]);

  const updateTiming = useCallback((timing: ReminderTiming) => {
    updatePreferences({
      ...preferences,
      timing,
    });
  }, [preferences, updatePreferences]);

  const toggleChannel = useCallback((channel: NotificationChannel, enabled: boolean) => {
    const channels = enabled
      ? [...preferences.channels, channel]
      : preferences.channels.filter((c) => c !== channel);

    updatePreferences({
      ...preferences,
      channels: channels.length === 0 ? ['browser'] : channels,
    });
  }, [preferences, updatePreferences]);

  const updateQuietHours = useCallback(
    (quietHours: ReminderPreferences['quietHours']) => {
      updatePreferences({
        ...preferences,
        quietHours,
      });
    },
    [preferences, updatePreferences]
  );

  const reset = useCallback(() => {
    resetReminderPreferences();
    setPreferences(getReminderPreferences());
  }, []);

  return {
    preferences,
    updatePreferences,
    toggleEnabled,
    updateTiming,
    toggleChannel,
    updateQuietHours,
    reset,
  };
}
