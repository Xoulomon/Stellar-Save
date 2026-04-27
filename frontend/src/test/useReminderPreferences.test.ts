import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReminderPreferences } from '../hooks/useReminderPreferences';
import * as reminderPrefs from '../notifications/reminderPreferences';

vi.mock('../notifications/reminderPreferences', () => ({
  getReminderPreferences: vi.fn(),
  setReminderPreferences: vi.fn(),
  resetReminderPreferences: vi.fn(),
  isWithinQuietHours: vi.fn(),
}));

describe('useReminderPreferences hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock default preferences
    vi.mocked(reminderPrefs.getReminderPreferences).mockReturnValue({
      enabled: true,
      timing: '24h',
      channels: ['browser'],
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      },
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize with default preferences', () => {
    const { result } = renderHook(() => useReminderPreferences());

    expect(result.current.preferences.enabled).toBe(true);
    expect(result.current.preferences.timing).toBe('24h');
    expect(result.current.preferences.channels).toEqual(['browser']);
  });

  it('should toggle reminder enabled state', async () => {
    const { result } = renderHook(() => useReminderPreferences());

    act(() => {
      result.current.toggleEnabled(false);
    });

    expect(vi.mocked(reminderPrefs.setReminderPreferences)).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false })
    );
  });

  it('should update reminder timing', async () => {
    const { result } = renderHook(() => useReminderPreferences());

    act(() => {
      result.current.updateTiming('1h');
    });

    expect(vi.mocked(reminderPrefs.setReminderPreferences)).toHaveBeenCalledWith(
      expect.objectContaining({ timing: '1h' })
    );
  });

  it('should toggle notification channel', async () => {
    const { result } = renderHook(() => useReminderPreferences());

    // Mock the updated preferences
    vi.mocked(reminderPrefs.getReminderPreferences).mockReturnValue({
      ...result.current.preferences,
      channels: ['browser', 'email'],
    });

    act(() => {
      result.current.toggleChannel('email', true);
    });

    expect(vi.mocked(reminderPrefs.setReminderPreferences)).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: expect.arrayContaining(['browser', 'email']),
      })
    );
  });

  it('should remove notification channel', async () => {
    // Mock preferences with both channels
    vi.mocked(reminderPrefs.getReminderPreferences).mockReturnValue({
      enabled: true,
      timing: '24h',
      channels: ['browser', 'email'],
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      },
    });

    const { result } = renderHook(() => useReminderPreferences());

    // Mock updated preferences
    vi.mocked(reminderPrefs.getReminderPreferences).mockReturnValue({
      ...result.current.preferences,
      channels: ['browser'],
    });

    act(() => {
      result.current.toggleChannel('email', false);
    });

    expect(vi.mocked(reminderPrefs.setReminderPreferences)).toHaveBeenCalled();
  });

  it('should ensure at least one channel is always enabled', async () => {
    vi.mocked(reminderPrefs.getReminderPreferences).mockReturnValue({
      enabled: true,
      timing: '24h',
      channels: ['browser'],
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      },
    });

    const { result } = renderHook(() => useReminderPreferences());

    act(() => {
      result.current.toggleChannel('browser', false);
    });

    const calls = vi.mocked(reminderPrefs.setReminderPreferences).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.channels.length).toBeGreaterThan(0);
  });

  it('should update quiet hours', async () => {
    const { result } = renderHook(() => useReminderPreferences());

    const newQuietHours = {
      enabled: true,
      startTime: '21:00',
      endTime: '09:00',
    };

    act(() => {
      result.current.updateQuietHours(newQuietHours);
    });

    expect(vi.mocked(reminderPrefs.setReminderPreferences)).toHaveBeenCalledWith(
      expect.objectContaining({ quietHours: newQuietHours })
    );
  });

  it('should reset preferences to defaults', async () => {
    const { result } = renderHook(() => useReminderPreferences());

    act(() => {
      result.current.reset();
    });

    expect(vi.mocked(reminderPrefs.resetReminderPreferences)).toHaveBeenCalled();
  });

  it('should sync preferences when reminder-preferences-changed event fires', async () => {
    const { result } = renderHook(() => useReminderPreferences());

    const newPreferences = {
      enabled: false,
      timing: '1h' as const,
      channels: ['email' as const],
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '08:00',
      },
    };

    vi.mocked(reminderPrefs.getReminderPreferences).mockReturnValue(newPreferences);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('reminder-preferences-changed', { detail: newPreferences })
      );
    });

    // The hook should have updated its state
    expect(result.current.preferences.enabled).toBe(false);
  });

  it('should handle storage event for cross-tab synchronization', async () => {
    const { result } = renderHook(() => useReminderPreferences());

    const newPreferences = {
      enabled: false,
      timing: '12h' as const,
      channels: ['browser' as const],
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      },
    };

    vi.mocked(reminderPrefs.getReminderPreferences).mockReturnValue(newPreferences);

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {}));
    });

    expect(reminderPrefs.getReminderPreferences).toHaveBeenCalled();
  });
});
