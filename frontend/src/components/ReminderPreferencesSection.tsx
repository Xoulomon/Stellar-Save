import { Stack, Typography, FormControlLabel, Switch, Box } from '@mui/material';
import { useReminderPreferences } from '../hooks/useReminderPreferences';
import type { ReminderTiming, NotificationChannel } from '../notifications/reminderPreferences';
import './ReminderPreferencesSection.css';

interface TimeOption {
  value: ReminderTiming;
  label: string;
  description: string;
}

const TIMING_OPTIONS: TimeOption[] = [
  { value: '1h', label: '1 hour before', description: 'Get reminded 1 hour before deadline' },
  { value: '12h', label: '12 hours before', description: 'Get reminded 12 hours before deadline' },
  { value: '24h', label: '24 hours before', description: 'Get reminded a day before deadline' },
];

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string; description: string }[] = [
  {
    value: 'browser',
    label: 'Browser Notifications',
    description: 'Receive notifications in your browser',
  },
  { value: 'email', label: 'Email', description: 'Receive email reminders' },
];

/**
 * Component for managing contribution reminder preferences.
 * Allows users to configure timing, channels, and quiet hours.
 */
export function ReminderPreferencesSection() {
  const {
    preferences,
    toggleEnabled,
    updateTiming,
    toggleChannel,
    updateQuietHours,
    reset,
  } = useReminderPreferences();

  const handleQuietHoursToggle = () => {
    updateQuietHours({
      ...preferences.quietHours,
      enabled: !preferences.quietHours.enabled,
    });
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateQuietHours({
      ...preferences.quietHours,
      startTime: e.target.value,
    });
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateQuietHours({
      ...preferences.quietHours,
      endTime: e.target.value,
    });
  };

  return (
    <Stack spacing={3}>
      {/* ── Header ────────────────────────────────────────────── */}
      <Stack spacing={1}>
        <Typography variant="subtitle1" fontWeight={600}>
          Contribution Reminders
        </Typography>
        <Typography color="text.secondary" variant="body2">
          Configure when and how you receive reminders to make contributions to your groups.
        </Typography>
      </Stack>

      {/* ── Enable/Disable Reminders ──────────────────────────── */}
      <FormControlLabel
        control={
          <Switch
            checked={preferences.enabled}
            onChange={(e) => toggleEnabled(e.target.checked)}
          />
        }
        label="Enable contribution reminders"
      />

      {preferences.enabled && (
        <>
          {/* ── Reminder Timing ───────────────────────────────── */}
          <Stack spacing={2} className="reminder-section">
            <Typography variant="body2" fontWeight={600}>
              Remind me before contribution deadline
            </Typography>

            <Box className="timing-options">
              {TIMING_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`timing-option ${
                    preferences.timing === option.value ? 'selected' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="timing"
                    value={option.value}
                    checked={preferences.timing === option.value}
                    onChange={() => updateTiming(option.value)}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={500}>
                      {option.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.description}
                    </Typography>
                  </Stack>
                </label>
              ))}
            </Box>
          </Stack>

          {/* ── Notification Channels ─────────────────────────── */}
          <Stack spacing={2} className="reminder-section">
            <Typography variant="body2" fontWeight={600}>
              How to notify me
            </Typography>

            <Stack spacing={1}>
              {CHANNEL_OPTIONS.map((option) => (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Switch
                      checked={preferences.channels.includes(option.value)}
                      onChange={(e) => toggleChannel(option.value, e.target.checked)}
                    />
                  }
                  label={
                    <Stack spacing={0.25}>
                      <Typography variant="body2">{option.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {option.description}
                      </Typography>
                    </Stack>
                  }
                />
              ))}
            </Stack>
          </Stack>

          {/* ── Quiet Hours ───────────────────────────────────── */}
          <Stack spacing={2} className="reminder-section">
            <Typography variant="body2" fontWeight={600}>
              Quiet Hours
            </Typography>
            <Typography color="text.secondary" variant="caption">
              Don't send reminders during these hours
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={preferences.quietHours.enabled}
                  onChange={handleQuietHoursToggle}
                />
              }
              label="Enable quiet hours"
            />

            {preferences.quietHours.enabled && (
              <Box className="quiet-hours-inputs">
                <Box className="time-input-group">
                  <label htmlFor="start-time">From</label>
                  <input
                    id="start-time"
                    type="time"
                    value={preferences.quietHours.startTime}
                    onChange={handleStartTimeChange}
                    className="time-input"
                  />
                </Box>

                <Box className="time-input-group">
                  <label htmlFor="end-time">To</label>
                  <input
                    id="end-time"
                    type="time"
                    value={preferences.quietHours.endTime}
                    onChange={handleEndTimeChange}
                    className="time-input"
                  />
                </Box>
              </Box>
            )}
          </Stack>

          {/* ── Reset Button ──────────────────────────────────── */}
          <Stack direction="row" spacing={1}>
            <button
              onClick={reset}
              className="reset-button"
              aria-label="Reset reminder preferences to defaults"
            >
              Reset to Defaults
            </button>
          </Stack>
        </>
      )}
    </Stack>
  );
}
