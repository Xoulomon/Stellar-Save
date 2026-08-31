/**
 * Reminder Scheduling Logic Module
 *
 * Pure, isolated functions for calculating contribution reminder schedules,
 * handling timezone conversions, DST transitions, user preferences,
 * quiet hours, and mute overrides.
 *
 * Issue #1301
 */

export interface ReminderPreferences {
  emailNotifications?: boolean;
  contributionReminders?: boolean;
  muteAll?: boolean;
  quietHoursStart?: string; // HH:mm format, e.g. "22:00"
  quietHoursEnd?: string;   // HH:mm format, e.g. "07:00"
  preferredTimeOfDay?: string; // HH:mm format, e.g. "09:00"
  timezone?: string;        // IANA timezone string, e.g. "America/New_York"
  leadHours?: number[];     // Custom lead times in hours, e.g. [48, 24]
}

export interface ScheduleReminderOptions {
  deadline: Date;
  preferences?: ReminderPreferences;
  now?: Date;
}

export interface ScheduledSlot {
  window: string; // e.g. "48h", "24h"
  leadHours: number;
  scheduledTime: Date;
  isMuted: boolean;
  skipReason?: 'opted_out' | 'quiet_hours' | 'in_past';
}

/**
 * Check if a local time string "HH:mm" falls within quiet hours interval [quietStart, quietEnd].
 * Handles overnight intervals (e.g. 22:00 to 07:00).
 */
export function isTimeInQuietHours(timeStr: string, quietStart: string, quietEnd: string): boolean {
  const [h, m] = timeStr.split(':').map(Number);
  const [startH, startM] = quietStart.split(':').map(Number);
  const [endH, endM] = quietEnd.split(':').map(Number);

  const currentMinutes = h * 60 + m;
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    // Same day interval (e.g. 13:00 to 17:00)
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight interval (e.g. 22:00 to 07:00)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

/**
 * Format a Date object into "HH:mm" in the specified timezone.
 */
export function formatLocalTime(date: Date, timezone = 'UTC'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value.padStart(2, '0') ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value.padStart(2, '0') ?? '00';
    // Handle 24:00 edge case from Intl
    const formattedHour = hour === '24' ? '00' : hour;
    return `${formattedHour}:${minute}`;
  } catch {
    // Fallback to UTC if timezone is invalid
    const h = String(date.getUTCHours()).padStart(2, '0');
    const m = String(date.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/**
 * Adjust a Date to represent a specific local time "HH:mm" in a target timezone,
 * accounting for DST transitions and offsets.
 */
export function adjustTimeForTimezone(baseDate: Date, targetTime: string, timezone = 'UTC'): Date {
  const [targetH, targetM] = targetTime.split(':').map(Number);

  // Obtain local date components in target timezone
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(baseDate);
    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value) - 1;
    const day = Number(parts.find((p) => p.type === 'day')?.value);

    // Create UTC date target, then find exact offset in target timezone
    const utcTestDate = new Date(Date.UTC(year, month, day, targetH, targetM, 0, 0));

    // Get offset between UTC and local timezone at that specific time
    const tzFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    // We compute the exact difference in minutes between UTC test date and its local rendering
    const localParts = tzFormatter.formatToParts(utcTestDate);
    const lH = Number(localParts.find((p) => p.type === 'hour')?.value % 24);
    const lM = Number(localParts.find((p) => p.type === 'minute')?.value);

    const diffMinutes = (lH * 60 + lM) - (targetH * 60 + targetM);
    return new Date(utcTestDate.getTime() - diffMinutes * 60 * 1000);
  } catch {
    // Fallback if timezone string is invalid
    const result = new Date(baseDate);
    result.setUTCHours(targetH, targetM, 0, 0);
    return result;
  }
}

/**
 * Main pure schedule calculation function.
 * Determines all scheduled reminder slots for a contribution deadline.
 */
export function calculateReminderSchedules(options: ScheduleReminderOptions): ScheduledSlot[] {
  const { deadline, preferences, now = new Date() } = options;
  const leadHoursList = preferences?.leadHours ?? [48, 24];
  const timezone = preferences?.timezone ?? 'UTC';
  const slots: ScheduledSlot[] = [];

  // Check global user mute / opt-out status
  const isOptedOut =
    preferences?.contributionReminders === false ||
    preferences?.emailNotifications === false ||
    preferences?.muteAll === true;

  for (const leadHours of leadHoursList) {
    const windowName = `${leadHours}h`;
    let scheduledTime = new Date(deadline.getTime() - leadHours * 60 * 60 * 1000);

    // Override with custom preferred time of day if set
    if (preferences?.preferredTimeOfDay) {
      scheduledTime = adjustTimeForTimezone(scheduledTime, preferences.preferredTimeOfDay, timezone);
    }

    let skipReason: ScheduledSlot['skipReason'];
    let isMuted = false;

    if (isOptedOut) {
      isMuted = true;
      skipReason = 'opted_out';
    } else if (scheduledTime.getTime() <= now.getTime()) {
      isMuted = true;
      skipReason = 'in_past';
    } else if (
      preferences?.quietHoursStart &&
      preferences?.quietHoursEnd &&
      isTimeInQuietHours(
        formatLocalTime(scheduledTime, timezone),
        preferences.quietHoursStart,
        preferences.quietHoursEnd
      )
    ) {
      // If time falls in quiet hours, shift to quiet hours end
      scheduledTime = adjustTimeForTimezone(scheduledTime, preferences.quietHoursEnd, timezone);
      if (scheduledTime.getTime() <= now.getTime()) {
        isMuted = true;
        skipReason = 'in_past';
      }
    }

    slots.push({
      window: windowName,
      leadHours,
      scheduledTime,
      isMuted,
      ...(skipReason ? { skipReason } : {}),
    });
  }

  return slots;
}
