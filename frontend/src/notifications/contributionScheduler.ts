/**
 * contributionScheduler.ts
 *
 * Schedules browser push notifications for contribution deadlines.
 *
 * Strategy:
 *  - Uses window.setTimeout for scheduling (works across tab visibility states
 *    because the SW receives the message and shows the notification even if the
 *    tab is backgrounded — the browser keeps SW-controlled timeouts alive).
 *  - Persists scheduled reminder IDs in localStorage so they survive page
 *    refreshes and can be cancelled.
 *  - Fires reminders at: T-24h and T-1h before the deadline.
 */

import { canShowNotifications } from './notificationPermission';
import { postToServiceWorker } from './serviceWorkerRegistration';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContributionReminder {
  groupId: string;
  groupName: string;
  deadlineTimestamp: number; // Unix ms
}

interface ScheduledReminder {
  groupId: string;
  offsetLabel: string; // '24h' | '1h'
  timeoutId: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'stellar_save_reminders';
const OFFSETS_MS: Array<{ label: string; ms: number }> = [
  { label: '24h', ms: 24 * 60 * 60 * 1000 },
  { label: '1h', ms: 60 * 60 * 1000 },
];

// In-memory map of active timeouts: `${groupId}:${offsetLabel}` → timeoutId
const activeTimeouts = new Map<string, number>();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedules 24h and 1h reminders for a contribution deadline.
 * Silently skips offsets that are already in the past.
 *
 * @param reminder - Group info and deadline timestamp.
 */
export function scheduleContributionReminders(reminder: ContributionReminder): void {
  if (!canShowNotifications()) {
    console.warn('[Scheduler] Notifications not permitted — skipping schedule.');
    return;
  }

  const now = Date.now();

  for (const { label, ms } of OFFSETS_MS) {
    const fireAt = reminder.deadlineTimestamp - ms;
    const delay = fireAt - now;

    if (delay <= 0) {
      // Offset already passed — skip silently
      continue;
    }

    const key = `${reminder.groupId}:${label}`;

    // Cancel any existing timeout for this key before re-scheduling
    cancelReminder(reminder.groupId, label);

    const timeoutId = window.setTimeout(() => {
      void fireReminder(reminder, label);
      activeTimeouts.delete(key);
      persistReminders();
    }, delay);

    activeTimeouts.set(key, timeoutId);
  }

  persistReminders();
}

/**
 * Cancels all scheduled reminders for a group.
 */
export function cancelGroupReminders(groupId: string): void {
  for (const { label } of OFFSETS_MS) {
    cancelReminder(groupId, label);
  }
  persistReminders();
}

/**
 * Cancels all scheduled reminders (e.g. on wallet disconnect).
 */
export function cancelAllReminders(): void {
  for (const timeoutId of activeTimeouts.values()) {
    window.clearTimeout(timeoutId);
  }
  activeTimeouts.clear();
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Returns the list of currently scheduled reminders (for debugging / UI).
 */
export function getScheduledReminders(): ScheduledReminder[] {
  return Array.from(activeTimeouts.entries()).map(([key, timeoutId]) => {
    const [groupId, offsetLabel] = key.split(':');
    return { groupId, offsetLabel, timeoutId };
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fireReminder(reminder: ContributionReminder, offsetLabel: string): Promise<void> {
  const body =
    offsetLabel === '24h'
      ? `You have 24 hours to contribute to "${reminder.groupName}".`
      : `Only 1 hour left to contribute to "${reminder.groupName}"!`;

  await postToServiceWorker({
    type: 'SHOW_NOTIFICATION',
    title: 'Contribution Reminder',
    body,
    groupId: reminder.groupId,
  });
}

function cancelReminder(groupId: string, offsetLabel: string): void {
  const key = `${groupId}:${offsetLabel}`;
  const existing = activeTimeouts.get(key);
  if (existing !== undefined) {
    window.clearTimeout(existing);
    activeTimeouts.delete(key);
  }
}

/** Persist active reminder metadata (not timeout IDs) to localStorage. */
function persistReminders(): void {
  const data = Array.from(activeTimeouts.keys());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
