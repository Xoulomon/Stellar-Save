import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPage } from '../pages/SettingsPage';

/**
 * Integration tests for the Settings Page with Reminder Preferences
 * Verifies that the complete flow works end-to-end
 */
describe('SettingsPage Integration - Reminder Preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should render the settings page with reminder preferences section', () => {
    render(<SettingsPage />);

    // Check page title
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // Check appearance section
    expect(screen.getByText('Appearance')).toBeInTheDocument();

    // Check reminder section
    expect(screen.getByText('Contribution Reminders')).toBeInTheDocument();
    expect(
      screen.getByText(/Configure when and how you receive reminders/)
    ).toBeInTheDocument();
  });

  it('should have the divider between sections', () => {
    const { container } = render(<SettingsPage />);

    // Check for Material-UI Divider component
    const dividers = container.querySelectorAll('.MuiDivider-root');
    expect(dividers.length).toBeGreaterThan(0);
  });

  it('should allow toggling reminders on and off', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const reminderToggle = screen.getByRole('checkbox', {
      name: /Enable contribution reminders/,
    });

    expect(reminderToggle).toBeChecked();

    // Toggle off
    await user.click(reminderToggle);
    expect(reminderToggle).not.toBeChecked();

    // Toggle back on
    await user.click(reminderToggle);
    expect(reminderToggle).toBeChecked();
  });

  it('should show/hide reminder options based on enabled state', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    const reminderToggle = screen.getByRole('checkbox', {
      name: /Enable contribution reminders/,
    });

    // Initially enabled - should show options
    expect(screen.getByText('Remind me before contribution deadline')).toBeInTheDocument();

    // Toggle off
    await user.click(reminderToggle);

    // Options should be hidden
    expect(
      screen.queryByText('Remind me before contribution deadline')
    ).not.toBeInTheDocument();
  });

  it('should persist preferences to localStorage', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    // Enable reminders (should be on by default)
    const reminderToggle = screen.getByRole('checkbox', {
      name: /Enable contribution reminders/,
    });

    // By default should have reminder preferences in localStorage
    // after toggling a setting
    const oneHourOption = screen.getByDisplayValue('1h');
    await user.click(oneHourOption);

    // Check localStorage
    const stored = localStorage.getItem('stellar_save_reminder_preferences');
    expect(stored).toBeTruthy();

    const prefs = JSON.parse(stored!);
    expect(prefs.timing).toBe('1h');
  });

  it('should maintain theme settings alongside reminder preferences', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    // Change theme
    const darkThemeOption = screen.getByLabelText('Dark');
    await user.click(darkThemeOption);

    // Change reminder timing
    const oneHourOption = screen.getByDisplayValue('1h');
    await user.click(oneHourOption);

    // Both settings should be available on re-render
    const { rerender } = render(<SettingsPage />);
    rerender(<SettingsPage />);

    expect(screen.getByText('Contribution Reminders')).toBeInTheDocument();
  });

  it('should allow configuration of multiple settings', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    // Change reminder timing
    const oneHourOption = screen.getByDisplayValue('1h');
    await user.click(oneHourOption);

    // Enable quiet hours
    const quietHoursToggle = screen.getByRole('checkbox', {
      name: /Enable quiet hours/,
    });
    await user.click(quietHoursToggle);

    // Time inputs should appear
    expect(screen.getByDisplayValue('22:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('08:00')).toBeInTheDocument();

    // Change quiet hours
    const startTimeInput = screen.getByDisplayValue('22:00');
    await user.clear(startTimeInput);
    await user.type(startTimeInput, '23:00');

    // Verify localStorage
    const stored = localStorage.getItem('stellar_save_reminder_preferences');
    const prefs = JSON.parse(stored!);
    expect(prefs.timing).toBe('1h');
    expect(prefs.quietHours.enabled).toBe(true);
    expect(prefs.quietHours.startTime).toBe('23:00');
  });

  it('should have reset button that restores defaults', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);

    // Change some settings
    const oneHourOption = screen.getByDisplayValue('1h');
    await user.click(oneHourOption);

    const resetButton = screen.getByRole('button', { name: /Reset to Defaults/ });
    expect(resetButton).toBeInTheDocument();

    // Click reset
    await user.click(resetButton);

    // Verify localStorage is reset
    const stored = localStorage.getItem('stellar_save_reminder_preferences');
    const prefs = JSON.parse(stored!);
    expect(prefs.timing).toBe('24h');
    expect(prefs.channels).toEqual(['browser']);
  });
});
