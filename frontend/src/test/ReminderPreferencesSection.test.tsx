import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReminderPreferencesSection } from '../components/ReminderPreferencesSection';
import * as useReminderPrefs from '../hooks/useReminderPreferences';

vi.mock('../hooks/useReminderPreferences', () => ({
  useReminderPreferences: vi.fn(),
}));

describe('ReminderPreferencesSection Component', () => {
  const mockHookFunctions = {
    toggleEnabled: vi.fn(),
    updateTiming: vi.fn(),
    toggleChannel: vi.fn(),
    updateQuietHours: vi.fn(),
    reset: vi.fn(),
  };

  const defaultMockReturn = {
    preferences: {
      enabled: true,
      timing: '24h' as const,
      channels: ['browser' as const],
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00',
      },
    },
    ...mockHookFunctions,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useReminderPrefs.useReminderPreferences).mockReturnValue(defaultMockReturn);
  });

  describe('Rendering and Initial State', () => {
    it('should render the section title and description', () => {
      render(<ReminderPreferencesSection />);

      expect(screen.getByText('Contribution Reminders')).toBeInTheDocument();
      expect(
        screen.getByText(/Configure when and how you receive reminders/)
      ).toBeInTheDocument();
    });

    it('should display the reminders enabled toggle', () => {
      render(<ReminderPreferencesSection />);

      expect(screen.getByLabelText('Enable contribution reminders')).toBeInTheDocument();
    });

    it('should collapse reminder options when disabled', () => {
      vi.mocked(useReminderPrefs.useReminderPreferences).mockReturnValue({
        ...defaultMockReturn,
        preferences: { ...defaultMockReturn.preferences, enabled: false },
      });

      render(<ReminderPreferencesSection />);

      expect(screen.queryByText('Remind me before contribution deadline')).not.toBeInTheDocument();
      expect(screen.queryByText('How to notify me')).not.toBeInTheDocument();
    });

    it('should show reminder options when enabled', () => {
      render(<ReminderPreferencesSection />);

      expect(screen.getByText('Remind me before contribution deadline')).toBeInTheDocument();
      expect(screen.getByText('How to notify me')).toBeInTheDocument();
      expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
    });
  });

  describe('Timing Selection', () => {
    it('should display all timing options', () => {
      render(<ReminderPreferencesSection />);

      expect(screen.getByDisplayValue('1h')).toBeInTheDocument();
      expect(screen.getByDisplayValue('12h')).toBeInTheDocument();
      expect(screen.getByDisplayValue('24h')).toBeInTheDocument();
    });

    it('should show selected timing option', () => {
      render(<ReminderPreferencesSection />);

      const radioButton = screen.getByDisplayValue('24h') as HTMLInputElement;
      expect(radioButton.checked).toBe(true);
    });

    it('should update timing when option is selected', async () => {
      const user = userEvent.setup();
      render(<ReminderPreferencesSection />);

      const oneHourOption = screen.getByDisplayValue('1h');
      await user.click(oneHourOption);

      expect(mockHookFunctions.updateTiming).toHaveBeenCalledWith('1h');
    });

    it('should display timing option descriptions', () => {
      render(<ReminderPreferencesSection />);

      expect(screen.getByText('Get reminded 1 hour before deadline')).toBeInTheDocument();
      expect(screen.getByText('Get reminded 12 hours before deadline')).toBeInTheDocument();
      expect(screen.getByText('Get reminded a day before deadline')).toBeInTheDocument();
    });
  });

  describe('Notification Channels', () => {
    it('should display all channel options', () => {
      render(<ReminderPreferencesSection />);

      expect(screen.getByLabelText(/Browser Notifications/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
    });

    it('should show selected channels', () => {
      render(<ReminderPreferencesSection />);

      const browserCheckbox = screen.getByLabelText(/Receive notifications in your browser/);
      expect(browserCheckbox).toBeChecked();
    });

    it('should toggle channel when switch is clicked', async () => {
      const user = userEvent.setup();
      render(<ReminderPreferencesSection />);

      const emailSwitch = screen.getByRole('checkbox', {
        name: /Receive email reminders/,
      });

      await user.click(emailSwitch);

      expect(mockHookFunctions.toggleChannel).toHaveBeenCalledWith('email', true);
    });

    it('should display channel descriptions', () => {
      render(<ReminderPreferencesSection />);

      expect(screen.getByText('Receive notifications in your browser')).toBeInTheDocument();
      expect(screen.getByText('Receive email reminders')).toBeInTheDocument();
    });
  });

  describe('Quiet Hours', () => {
    it('should display quiet hours section', () => {
      render(<ReminderPreferencesSection />);

      expect(screen.getByText('Quiet Hours')).toBeInTheDocument();
      expect(
        screen.getByText("Don't send reminders during these hours")
      ).toBeInTheDocument();
    });

    it('should toggle quiet hours', async () => {
      const user = userEvent.setup();
      render(<ReminderPreferencesSection />);

      const quietHoursToggle = screen.getByLabelText('Enable quiet hours');
      await user.click(quietHoursToggle);

      expect(mockHookFunctions.updateQuietHours).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: true })
      );
    });

    it('should show time inputs when quiet hours are enabled', () => {
      vi.mocked(useReminderPrefs.useReminderPreferences).mockReturnValue({
        ...defaultMockReturn,
        preferences: {
          ...defaultMockReturn.preferences,
          quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
        },
      });

      render(<ReminderPreferencesSection />);

      expect(screen.getByDisplayValue('22:00')).toBeInTheDocument();
      expect(screen.getByDisplayValue('08:00')).toBeInTheDocument();
    });

    it('should hide time inputs when quiet hours are disabled', () => {
      render(<ReminderPreferencesSection />);

      expect(screen.queryByDisplayValue('22:00')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue('08:00')).not.toBeInTheDocument();
    });

    it('should update start time', async () => {
      const user = userEvent.setup();

      vi.mocked(useReminderPrefs.useReminderPreferences).mockReturnValue({
        ...defaultMockReturn,
        preferences: {
          ...defaultMockReturn.preferences,
          quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
        },
      });

      render(<ReminderPreferencesSection />);

      const startTimeInput = screen.getByDisplayValue('22:00');
      await user.clear(startTimeInput);
      await user.type(startTimeInput, '21:00');

      expect(mockHookFunctions.updateQuietHours).toHaveBeenCalledWith(
        expect.objectContaining({ startTime: '21:00' })
      );
    });

    it('should update end time', async () => {
      const user = userEvent.setup();

      vi.mocked(useReminderPrefs.useReminderPreferences).mockReturnValue({
        ...defaultMockReturn,
        preferences: {
          ...defaultMockReturn.preferences,
          quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
        },
      });

      render(<ReminderPreferencesSection />);

      const endTimeInput = screen.getByDisplayValue('08:00');
      await user.clear(endTimeInput);
      await user.type(endTimeInput, '09:00');

      expect(mockHookFunctions.updateQuietHours).toHaveBeenCalledWith(
        expect.objectContaining({ endTime: '09:00' })
      );
    });
  });

  describe('Reset Button', () => {
    it('should display reset button', () => {
      render(<ReminderPreferencesSection />);

      expect(screen.getByRole('button', { name: /Reset to Defaults/ })).toBeInTheDocument();
    });

    it('should call reset function when button is clicked', async () => {
      const user = userEvent.setup();
      render(<ReminderPreferencesSection />);

      const resetButton = screen.getByRole('button', { name: /Reset to Defaults/ });
      await user.click(resetButton);

      expect(mockHookFunctions.reset).toHaveBeenCalled();
    });

    it('should hide reset button when reminders are disabled', () => {
      vi.mocked(useReminderPrefs.useReminderPreferences).mockReturnValue({
        ...defaultMockReturn,
        preferences: { ...defaultMockReturn.preferences, enabled: false },
      });

      render(<ReminderPreferencesSection />);

      expect(
        screen.queryByRole('button', { name: /Reset to Defaults/ })
      ).not.toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('should handle multiple state changes correctly', async () => {
      const user = userEvent.setup();

      vi.mocked(useReminderPrefs.useReminderPreferences).mockReturnValue({
        ...defaultMockReturn,
        preferences: {
          ...defaultMockReturn.preferences,
          quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
        },
      });

      render(<ReminderPreferencesSection />);

      // Change timing
      const oneHourOption = screen.getByDisplayValue('1h');
      await user.click(oneHourOption);

      // Toggle email channel
      const emailSwitch = screen.getByRole('checkbox', { name: /Receive email reminders/ });
      await user.click(emailSwitch);

      // Update start time
      const startTimeInput = screen.getByDisplayValue('22:00');
      await user.clear(startTimeInput);
      await user.type(startTimeInput, '21:00');

      expect(mockHookFunctions.updateTiming).toHaveBeenCalledWith('1h');
      expect(mockHookFunctions.toggleChannel).toHaveBeenCalledWith('email', true);
      expect(mockHookFunctions.updateQuietHours).toHaveBeenCalledWith(
        expect.objectContaining({ startTime: '21:00' })
      );
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for all inputs', () => {
      vi.mocked(useReminderPrefs.useReminderPreferences).mockReturnValue({
        ...defaultMockReturn,
        preferences: {
          ...defaultMockReturn.preferences,
          quietHours: { enabled: true, startTime: '22:00', endTime: '08:00' },
        },
      });

      render(<ReminderPreferencesSection />);

      expect(screen.getByLabelText('From')).toBeInTheDocument();
      expect(screen.getByLabelText('To')).toBeInTheDocument();
    });

    it('should have aria labels on buttons', () => {
      render(<ReminderPreferencesSection />);

      const resetButton = screen.getByRole('button', { name: /Reset to Defaults/ });
      expect(resetButton).toHaveAttribute('aria-label');
    });
  });
});
