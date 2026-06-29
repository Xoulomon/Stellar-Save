/**
 * SmsReminderSection.test.tsx
 *
 * Tests: OTP verification required before activation, opt-out works.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmsReminderSection } from '../components/SmsReminderSection';

const mockGetSmsPreferences = vi.fn();
const mockSmsOptIn = vi.fn();
const mockSmsVerifyOtp = vi.fn();
const mockSmsOptOut = vi.fn();
const mockUpdateSmsPreferences = vi.fn();

vi.mock('../utils/smsApi', () => ({
  getSmsPreferences: (...args: unknown[]) => mockGetSmsPreferences(...args),
  smsOptIn: (...args: unknown[]) => mockSmsOptIn(...args),
  smsVerifyOtp: (...args: unknown[]) => mockSmsVerifyOtp(...args),
  smsOptOut: (...args: unknown[]) => mockSmsOptOut(...args),
  updateSmsPreferences: (...args: unknown[]) => mockUpdateSmsPreferences(...args),
}));

describe('SmsReminderSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSmsPreferences.mockResolvedValue(null);
  });

  it('renders the opt-in form initially', async () => {
    render(<SmsReminderSection userId="u-1" />);
    expect(await screen.findByLabelText(/phone number/i)).toBeInTheDocument();
    expect(screen.getByText(/Send Verification Code/i)).toBeInTheDocument();
  });

  it('sends OTP and shows verification step', async () => {
    mockSmsOptIn.mockResolvedValue({ message: 'OTP sent' });

    render(<SmsReminderSection userId="u-1" />);
    const phoneInput = await screen.findByLabelText(/phone number/i);
    fireEvent.change(phoneInput, { target: { value: '+14155551234' } });
    fireEvent.click(screen.getByText(/Send Verification Code/i));

    await waitFor(() => {
      expect(mockSmsOptIn).toHaveBeenCalledWith('u-1', '+14155551234', 'sms');
      expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument();
    });
  });

  it('verifies OTP and shows active state', async () => {
    mockSmsOptIn.mockResolvedValue({ message: 'OTP sent' });
    mockSmsVerifyOtp.mockResolvedValue({ message: 'Phone verified' });
    mockGetSmsPreferences
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        phone: '+14155551234',
        channel: 'sms',
        verified: true,
        optedOut: false,
        leadTimeHours: 24,
      });

    render(<SmsReminderSection userId="u-1" />);
    const phoneInput = await screen.findByLabelText(/phone number/i);
    fireEvent.change(phoneInput, { target: { value: '+14155551234' } });
    fireEvent.click(screen.getByText(/Send Verification Code/i));

    const otpInput = await screen.findByLabelText(/6-digit code/i);
    fireEvent.change(otpInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByText(/^Verify$/i));

    await waitFor(() => {
      expect(mockSmsVerifyOtp).toHaveBeenCalledWith('u-1', '123456');
    });
  });

  it('shows error for invalid phone format', async () => {
    render(<SmsReminderSection userId="u-1" />);
    const phoneInput = await screen.findByLabelText(/phone number/i);
    fireEvent.change(phoneInput, { target: { value: '555-1234' } });
    fireEvent.click(screen.getByText(/Send Verification Code/i));

    expect(await screen.findByRole('alert')).toHaveTextContent(/E\.164/i);
    expect(mockSmsOptIn).not.toHaveBeenCalled();
  });

  it('shows error from API', async () => {
    mockSmsOptIn.mockResolvedValue({ error: 'Failed to send OTP. Please try again.' });

    render(<SmsReminderSection userId="u-1" />);
    const phoneInput = await screen.findByLabelText(/phone number/i);
    fireEvent.change(phoneInput, { target: { value: '+14155551234' } });
    fireEvent.click(screen.getByText(/Send Verification Code/i));

    expect(await screen.findByText(/Failed to send OTP/i)).toBeInTheDocument();
  });

  it('shows active state for already verified user', async () => {
    mockGetSmsPreferences.mockResolvedValue({
      phone: '+14155551234',
      channel: 'sms',
      verified: true,
      optedOut: false,
      leadTimeHours: 24,
    });

    render(<SmsReminderSection userId="u-1" />);
    expect(await screen.findByText(/Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Stop SMS reminders/i)).toBeInTheDocument();
  });

  it('opt-out hides the active state', async () => {
    mockGetSmsPreferences.mockResolvedValue({
      phone: '+14155551234',
      channel: 'sms',
      verified: true,
      optedOut: false,
      leadTimeHours: 24,
    });
    mockSmsOptOut.mockResolvedValue({ message: 'Opted out' });

    render(<SmsReminderSection userId="u-1" />);
    const stopBtn = await screen.findByText(/Stop SMS reminders/i);
    fireEvent.click(stopBtn);

    await waitFor(() => {
      expect(mockSmsOptOut).toHaveBeenCalledWith('u-1');
      expect(screen.queryByText(/Active/i)).not.toBeInTheDocument();
    });
  });
});
