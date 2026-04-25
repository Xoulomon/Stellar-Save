import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getReminderPreferences,
  setReminderPreferences,
  resetReminderPreferences,
  isWithinQuietHours,
  type ReminderPreferences,
} from '../notifications/reminderPreferences';

describe('reminderPreferences utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getReminderPreferences', () => {
    it('should return default preferences when nothing is stored', () => {
      const prefs = getReminderPreferences();

      expect(prefs.enabled).toBe(true);
      expect(prefs.timing).toBe('24h');
      expect(prefs.channels).toEqual(['browser']);
      expect(prefs.quietHours.enabled).toBe(false);
    });

    it('should return stored preferences', () => {
      const customPrefs: ReminderPreferences = {
        enabled: false,
        timing: '1h',
        channels: ['email'],
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
        },
      };

      localStorage.setItem('stellar_save_reminder_preferences', JSON.stringify(customPrefs));

      const retrieved = getReminderPreferences();

      expect(retrieved).toEqual(customPrefs);
    });

    it('should merge stored preferences with defaults', () => {
      const partialPrefs = {
        enabled: false,
      };

      localStorage.setItem('stellar_save_reminder_preferences', JSON.stringify(partialPrefs));

      const retrieved = getReminderPreferences();

      expect(retrieved.enabled).toBe(false);
      expect(retrieved.timing).toBe('24h');
      expect(retrieved.channels).toEqual(['browser']);
    });

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('stellar_save_reminder_preferences', 'invalid json');

      const prefs = getReminderPreferences();

      expect(prefs.enabled).toBe(true);
      expect(prefs.timing).toBe('24h');
    });
  });

  describe('setReminderPreferences', () => {
    it('should store preferences in localStorage', () => {
      const prefs: ReminderPreferences = {
        enabled: true,
        timing: '12h',
        channels: ['browser', 'email'],
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00',
        },
      };

      setReminderPreferences(prefs);

      const stored = localStorage.getItem('stellar_save_reminder_preferences');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toEqual(prefs);
    });

    it('should dispatch custom event when preferences change', () => {
      const eventListener = vi.fn();
      window.addEventListener('reminder-preferences-changed', eventListener);

      const prefs: ReminderPreferences = {
        enabled: true,
        timing: '1h',
        channels: ['browser'],
        quietHours: { enabled: false, startTime: '', endTime: '' },
      };

      setReminderPreferences(prefs);

      expect(eventListener).toHaveBeenCalled();

      window.removeEventListener('reminder-preferences-changed', eventListener);
    });

    it('should handle localStorage errors gracefully', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const prefs: ReminderPreferences = {
        enabled: true,
        timing: '24h',
        channels: ['browser'],
        quietHours: { enabled: false, startTime: '', endTime: '' },
      };

      expect(() => setReminderPreferences(prefs)).not.toThrow();

      spy.mockRestore();
    });
  });

  describe('resetReminderPreferences', () => {
    it('should reset preferences to defaults', () => {
      const customPrefs: ReminderPreferences = {
        enabled: false,
        timing: '1h',
        channels: ['email'],
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
        },
      };

      setReminderPreferences(customPrefs);
      resetReminderPreferences();

      const retrieved = getReminderPreferences();

      expect(retrieved.enabled).toBe(true);
      expect(retrieved.timing).toBe('24h');
      expect(retrieved.channels).toEqual(['browser']);
      expect(retrieved.quietHours.enabled).toBe(false);
    });
  });

  describe('isWithinQuietHours', () => {
    it('should return false when quiet hours are disabled', () => {
      const prefs: ReminderPreferences = {
        enabled: true,
        timing: '24h',
        channels: ['browser'],
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00',
        },
      };

      const result = isWithinQuietHours(prefs);
      expect(result).toBe(false);
    });

    it('should detect when current time is within quiet hours (normal case)', () => {
      // Mock the current time to be 15:00
      const mockDate = new Date('2024-01-15T15:00:00');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const prefs: ReminderPreferences = {
        enabled: true,
        timing: '24h',
        channels: ['browser'],
        quietHours: {
          enabled: true,
          startTime: '14:00',
          endTime: '16:00',
        },
      };

      const result = isWithinQuietHours(prefs);
      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it('should detect when current time is outside quiet hours (normal case)', () => {
      const mockDate = new Date('2024-01-15T12:00:00');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const prefs: ReminderPreferences = {
        enabled: true,
        timing: '24h',
        channels: ['browser'],
        quietHours: {
          enabled: true,
          startTime: '14:00',
          endTime: '16:00',
        },
      };

      const result = isWithinQuietHours(prefs);
      expect(result).toBe(false);

      vi.useRealTimers();
    });

    it('should handle quiet hours spanning midnight (22:00 to 08:00)', () => {
      const mockDate = new Date('2024-01-15T23:30:00');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const prefs: ReminderPreferences = {
        enabled: true,
        timing: '24h',
        channels: ['browser'],
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
        },
      };

      const result = isWithinQuietHours(prefs);
      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it('should handle quiet hours spanning midnight - before start time', () => {
      const mockDate = new Date('2024-01-15T07:30:00');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const prefs: ReminderPreferences = {
        enabled: true,
        timing: '24h',
        channels: ['browser'],
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
        },
      };

      const result = isWithinQuietHours(prefs);
      expect(result).toBe(true);

      vi.useRealTimers();
    });

    it('should handle quiet hours spanning midnight - outside hours', () => {
      const mockDate = new Date('2024-01-15T12:00:00');
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      const prefs: ReminderPreferences = {
        enabled: true,
        timing: '24h',
        channels: ['browser'],
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
        },
      };

      const result = isWithinQuietHours(prefs);
      expect(result).toBe(false);

      vi.useRealTimers();
    });
  });
});
