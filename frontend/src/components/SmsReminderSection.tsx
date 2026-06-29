/**
 * SmsReminderSection.tsx
 *
 * UI panel for SMS/WhatsApp reminder opt-in with OTP verification.
 * Shows current status, lead-time picker, and opt-out.
 */

import { useState, useEffect } from 'react';
import {
  Stack,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
  smsOptIn,
  smsVerifyOtp,
  getSmsPreferences,
  updateSmsPreferences,
  smsOptOut,
  type SmsPreferences,
} from '../utils/smsApi';

interface Props {
  userId: string;
}

type Step = 'idle' | 'pending_otp' | 'verified';

const LEAD_TIME_OPTIONS = [
  { value: 1, label: '1 hour before' },
  { value: 12, label: '12 hours before' },
  { value: 24, label: '24 hours before' },
  { value: 48, label: '48 hours before' },
];

export function SmsReminderSection({ userId }: Props) {
  const [prefs, setPrefs] = useState<SmsPreferences | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getSmsPreferences(userId).then((p) => {
      if (p) {
        setPrefs(p);
        setPhone(p.phone);
        setChannel(p.channel as 'sms' | 'whatsapp');
        if (p.verified && !p.optedOut) setStep('verified');
        else if (!p.verified && !p.optedOut) setStep('pending_otp');
      }
    });
  }, [userId]);

  const handleSendOtp = async () => {
    setMsg(null);
    if (!phone.match(/^\+[1-9]\d{6,14}$/)) {
      setMsg({ type: 'error', text: 'Enter a valid phone number in E.164 format, e.g. +14155551234' });
      return;
    }
    setLoading(true);
    const res = await smsOptIn(userId, phone, channel);
    setLoading(false);
    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      setStep('pending_otp');
      setMsg({ type: 'success', text: 'Verification code sent! Enter it below.' });
    }
  };

  const handleVerifyOtp = async () => {
    setMsg(null);
    if (!otp.match(/^\d{6}$/)) {
      setMsg({ type: 'error', text: 'Enter the 6-digit code from your message' });
      return;
    }
    setLoading(true);
    const res = await smsVerifyOtp(userId, otp);
    setLoading(false);
    if (res.error) {
      setMsg({ type: 'error', text: res.error });
    } else {
      setStep('verified');
      setMsg({ type: 'success', text: 'Phone verified! You will receive reminders before contribution deadlines.' });
      const updated = await getSmsPreferences(userId);
      setPrefs(updated);
    }
  };

  const handleLeadTimeChange = async (hours: number) => {
    if (!prefs) return;
    const updated = await updateSmsPreferences(userId, { leadTimeHours: hours });
    setPrefs(updated);
  };

  const handleOptOut = async () => {
    setLoading(true);
    await smsOptOut(userId);
    setStep('idle');
    setPrefs(null);
    setOtp('');
    setMsg({ type: 'success', text: 'You have been opted out of SMS reminders.' });
    setLoading(false);
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="subtitle1" fontWeight={600}>
          SMS / WhatsApp Reminders
        </Typography>
        {step === 'verified' && (
          <Chip
            icon={<CheckCircleOutlineIcon />}
            label="Active"
            color="success"
            size="small"
          />
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary">
        Receive contribution deadline reminders via SMS or WhatsApp, even without internet access.
      </Typography>

      {msg && (
        <Alert severity={msg.type} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {step !== 'verified' && (
        <Stack spacing={2}>
          <TextField
            label="Phone number (E.164)"
            placeholder="+14155551234"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            size="small"
            disabled={step === 'pending_otp'}
            inputProps={{ 'aria-label': 'Phone number for SMS reminders' }}
          />

          <FormControl size="small">
            <InputLabel id="channel-label">Channel</InputLabel>
            <Select
              labelId="channel-label"
              value={channel}
              label="Channel"
              onChange={(e) => setChannel(e.target.value as 'sms' | 'whatsapp')}
              disabled={step === 'pending_otp'}
            >
              <MenuItem value="sms">SMS</MenuItem>
              <MenuItem value="whatsapp">WhatsApp</MenuItem>
            </Select>
          </FormControl>

          {step === 'idle' && (
            <Button
              variant="contained"
              onClick={handleSendOtp}
              disabled={loading || !phone}
              startIcon={loading ? <CircularProgress size={16} /> : undefined}
            >
              Send Verification Code
            </Button>
          )}

          {step === 'pending_otp' && (
            <Stack spacing={1}>
              <TextField
                label="6-digit code"
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                size="small"
                inputProps={{ 'aria-label': 'OTP verification code', inputMode: 'numeric', maxLength: 6 }}
              />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length < 6}
                  startIcon={loading ? <CircularProgress size={16} /> : undefined}
                >
                  Verify
                </Button>
                <Button
                  variant="text"
                  size="small"
                  onClick={() => { setStep('idle'); setOtp(''); setMsg(null); }}
                >
                  Change number
                </Button>
              </Stack>
            </Stack>
          )}
        </Stack>
      )}

      {step === 'verified' && prefs && (
        <Stack spacing={2}>
          <Typography variant="body2">
            Reminders sent to <strong>{prefs.phone}</strong> via{' '}
            <strong>{prefs.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</strong>
          </Typography>

          <FormControl size="small" sx={{ maxWidth: 240 }}>
            <InputLabel id="lead-time-label">Remind me</InputLabel>
            <Select
              labelId="lead-time-label"
              value={prefs.leadTimeHours}
              label="Remind me"
              onChange={(e) => handleLeadTimeChange(Number(e.target.value))}
            >
              {LEAD_TIME_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={handleOptOut}
            disabled={loading}
            sx={{ alignSelf: 'flex-start' }}
          >
            Stop SMS reminders
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
