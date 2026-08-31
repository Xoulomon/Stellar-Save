import {
  calculateReminderSchedules,
  isTimeInQuietHours,
  formatLocalTime,
  adjustTimeForTimezone,
  ReminderPreferences,
} from '../services/reminder_scheduler';

describe('Reminder Scheduler Module Unit Tests', () => {
  const referenceNow = new Date('2026-03-01T00:00:00.000Z');
  const deadline = new Date('2026-03-10T12:00:00.000Z');

  describe('calculateReminderSchedules', () => {
    it('calculates standard 48h and 24h lead time slots by default', () => {
      const slots = calculateReminderSchedules({
        deadline,
        now: referenceNow,
      });

      expect(slots).toHaveLength(2);
      expect(slots[0].window).toBe('48h');
      expect(slots[0].scheduledTime.toISOString()).toBe('2026-03-08T12:00:00.000Z');
      expect(slots[0].isMuted).toBe(false);

      expect(slots[1].window).toBe('24h');
      expect(slots[1].scheduledTime.toISOString()).toBe('2026-03-09T12:00:00.000Z');
      expect(slots[1].isMuted).toBe(false);
    });

    it('respects custom lead hours option', () => {
      const preferences: ReminderPreferences = { leadHours: [72, 36, 12] };
      const slots = calculateReminderSchedules({
        deadline,
        preferences,
        now: referenceNow,
      });

      expect(slots).toHaveLength(3);
      expect(slots[0].leadHours).toBe(72);
      expect(slots[1].leadHours).toBe(36);
      expect(slots[2].leadHours).toBe(12);
    });

    it('marks slots as muted when user opts out or enables muteAll', () => {
      const prefOptOut: ReminderPreferences = { contributionReminders: false };
      const slots1 = calculateReminderSchedules({ deadline, preferences: prefOptOut, now: referenceNow });
      expect(slots1[0].isMuted).toBe(true);
      expect(slots1[0].skipReason).toBe('opted_out');

      const prefMuteAll: ReminderPreferences = { muteAll: true };
      const slots2 = calculateReminderSchedules({ deadline, preferences: prefMuteAll, now: referenceNow });
      expect(slots2[0].isMuted).toBe(true);
      expect(slots2[0].skipReason).toBe('opted_out');
    });

    it('marks slots in the past as muted with skipReason in_past', () => {
      const pastNow = new Date('2026-03-09T00:00:00.000Z'); // 48h slot is 2026-03-08 (in past)
      const slots = calculateReminderSchedules({ deadline, now: pastNow });

      expect(slots[0].isMuted).toBe(true);
      expect(slots[0].skipReason).toBe('in_past');
      expect(slots[1].isMuted).toBe(false);
    });

    it('adjusts scheduled time to preferredTimeOfDay in specified timezone', () => {
      const preferences: ReminderPreferences = {
        preferredTimeOfDay: '09:00',
        timezone: 'America/New_York', // EST is UTC-5 in early March
      };

      const slots = calculateReminderSchedules({ deadline, preferences, now: referenceNow });
      // 09:00 EST on March 8 is 14:00 UTC
      expect(slots[0].scheduledTime.toISOString()).toBe('2026-03-08T14:00:00.000Z');
    });
  });

  describe('isTimeInQuietHours', () => {
    it('evaluates same-day quiet hours correctly', () => {
      expect(isTimeInQuietHours('14:00', '13:00', '17:00')).toBe(true);
      expect(isTimeInQuietHours('11:00', '13:00', '17:00')).toBe(false);
    });

    it('evaluates overnight quiet hours correctly (e.g., 22:00 to 07:00)', () => {
      expect(isTimeInQuietHours('23:30', '22:00', '07:00')).toBe(true);
      expect(isTimeInQuietHours('04:15', '22:00', '07:00')).toBe(true);
      expect(isTimeInQuietHours('12:00', '22:00', '07:00')).toBe(false);
    });
  });

  describe('Timezone & DST Edge Cases', () => {
    it('handles Spring DST transition (March in US/NY)', () => {
      // US DST starts on second Sunday of March (March 8, 2026)
      const dateBeforeDST = new Date('2026-03-07T12:00:00.000Z');
      const dateAfterDST = new Date('2026-03-09T12:00:00.000Z');

      const adjustedBefore = adjustTimeForTimezone(dateBeforeDST, '09:00', 'America/New_York');
      const adjustedAfter = adjustTimeForTimezone(dateAfterDST, '09:00', 'America/New_York');

      // Before DST (EST = UTC-5): 09:00 EST = 14:00 UTC
      expect(adjustedBefore.getUTCHours()).toBe(14);
      // After DST (EDT = UTC-4): 09:00 EDT = 13:00 UTC
      expect(adjustedAfter.getUTCHours()).toBe(13);
    });

    it('handles Fall DST transition (November in Europe/London)', () => {
      // UK DST ends on last Sunday of October
      const dateSummer = new Date('2026-10-20T12:00:00.000Z'); // BST (UTC+1)
      const dateWinter = new Date('2026-11-05T12:00:00.000Z'); // GMT (UTC+0)

      const adjustedSummer = adjustTimeForTimezone(dateSummer, '10:00', 'Europe/London');
      const adjustedWinter = adjustTimeForTimezone(dateWinter, '10:00', 'Europe/London');

      // Summer BST (UTC+1): 10:00 BST = 09:00 UTC
      expect(adjustedSummer.getUTCHours()).toBe(9);
      // Winter GMT (UTC+0): 10:00 GMT = 10:00 UTC
      expect(adjustedWinter.getUTCHours()).toBe(10);
    });

    it('formats local time cleanly in formatLocalTime', () => {
      const testDate = new Date('2026-06-15T15:30:00.000Z');
      const formattedTokyo = formatLocalTime(testDate, 'Asia/Tokyo'); // Tokyo is UTC+9 (00:30 next day)
      expect(formattedTokyo).toBe('00:30');
    });
  });
});
