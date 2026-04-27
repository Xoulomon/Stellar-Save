/**
 * usePushNotifications.ts
 *
 * React hook that wires the notification system into the app lifecycle:
 *
 *  1. Registers the service worker on mount.
 *  2. Requests notification permission when the wallet connects.
 *  3. Exposes scheduleReminder / cancelReminder helpers.
 *  4. Exposes the user's on/off preference with a toggle.
 *
 * Usage:
 *   const { enabled, toggleEnabled, scheduleReminder } = usePushNotifications();
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWallet } from './useWallet';
import {
  requestNotificationPermission,
  getNotificationPermission,
  registerServiceWorker,
  scheduleContributionReminders,
  cancelGroupReminders,
  cancelAllReminders,
  isNotificationsEnabled,
  setNotificationsEnabled,
} from '../notifications';
import type { ContributionReminder, NotificationPermissionStatus } from '../notifications';

export interface UsePushNotificationsReturn {
  /** Current browser permission state */
  permission: NotificationPermissionStatus;
  /** Whether the user has opted in (their preference toggle) */
  enabled: boolean;
  /** Toggle the user's preference on/off */
  toggleEnabled: () => void;
  /** Schedule 24h + 1h reminders for a contribution deadline */
  scheduleReminder: (reminder: ContributionReminder) => void;
  /** Cancel all reminders for a specific group */
  cancelReminder: (groupId: string) => void;
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const { status, activeAddress } = useWallet();

  const [permission, setPermission] = useState<NotificationPermissionStatus>(
    getNotificationPermission,
  );
  const [enabled, setEnabled] = useState<boolean>(isNotificationsEnabled);

  // Track the previous wallet status so we only trigger on the transition
  // idle/connecting → connected, not on every render.
  const prevStatusRef = useRef(status);

  // ── Step 1: Register service worker on mount ────────────────────────────
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  // ── Step 2: Request permission when wallet connects ─────────────────────
  useEffect(() => {
    const justConnected =
      prevStatusRef.current !== 'connected' && status === 'connected';

    prevStatusRef.current = status;

    if (!justConnected || !activeAddress) return;
    if (permission === 'granted' || permission === 'denied') return;

    void requestNotificationPermission().then((result) => {
      setPermission(result);
    });
  }, [status, activeAddress, permission]);

  // ── Step 3: Cancel all reminders when wallet disconnects ────────────────
  useEffect(() => {
    if (status === 'idle') {
      cancelAllReminders();
    }
  }, [status]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const toggleEnabled = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      setNotificationsEnabled(next);
      if (!next) cancelAllReminders();
      return next;
    });
  }, []);

  const scheduleReminder = useCallback(
    (reminder: ContributionReminder) => {
      if (!enabled) return;
      scheduleContributionReminders(reminder);
    },
    [enabled],
  );

  const cancelReminder = useCallback((groupId: string) => {
    cancelGroupReminders(groupId);
  }, []);

  return { permission, enabled, toggleEnabled, scheduleReminder, cancelReminder };
}
