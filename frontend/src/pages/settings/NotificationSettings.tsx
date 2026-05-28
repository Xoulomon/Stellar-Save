import { useState } from 'react';
import {
  Stack,
  Typography,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  CircularProgress,
} from '@mui/material';
import { AppCard, AppLayout } from '../../ui';
import { AppButton } from '../../ui/components/AppButton';
import { useWallet } from '../../hooks/useWallet';

interface NotificationPrefs {
  emailNotifications: boolean;
  pushNotifications: boolean;
  contributionReminders: boolean;
  payoutNotifications: boolean;
  missedContribution: boolean;
}

const DEFAULTS: NotificationPrefs = {
  emailNotifications: true,
  pushNotifications: true,
  contributionReminders: true,
  payoutNotifications: true,
  missedContribution: true,
};

export default function NotificationSettings() {
  const { activeAddress } = useWallet();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const toggle = (key: keyof NotificationPrefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = async () => {
    if (!activeAddress) return;
    setSaving(true);
    setStatus('idle');
    try {
      const res = await fetch(`/api/v1/notifications/preferences/${activeAddress}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailNotifications: prefs.emailNotifications,
          pushNotifications: prefs.pushNotifications,
          contributionReminders: prefs.contributionReminders,
          payoutNotifications: prefs.payoutNotifications,
          groupUpdates: prefs.missedContribution,
        }),
      });
      setStatus(res.ok ? 'success' : 'error');
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const rows: { key: keyof NotificationPrefs; label: string; description: string }[] = [
    {
      key: 'emailNotifications',
      label: 'Email notifications',
      description: 'Receive notifications via email',
    },
    {
      key: 'pushNotifications',
      label: 'Push notifications',
      description: 'Receive browser push notifications',
    },
    {
      key: 'contributionReminders',
      label: 'Contribution reminders',
      description: 'Get reminded before your contribution deadline',
    },
    {
      key: 'payoutNotifications',
      label: 'Payout alerts',
      description: 'Be notified when a payout is processed',
    },
    {
      key: 'missedContribution',
      label: 'Missed contribution alerts',
      description: 'Get notified when a group member misses a contribution',
    },
  ];

  return (
    <AppLayout
      title="Notification Preferences"
      subtitle="Choose what you want to be notified about"
      footerText="Stellar Save — Built for transparent, on-chain savings"
    >
      <AppCard sx={{ maxWidth: 600 }}>
        <Stack spacing={3}>
          <Typography variant="h2">Notifications</Typography>

          {rows.map((row, i) => (
            <Stack key={row.key} spacing={0}>
              <FormControlLabel
                control={
                  <Switch
                    checked={prefs[row.key]}
                    onChange={() => toggle(row.key)}
                    inputProps={{ 'aria-label': row.label }}
                  />
                }
                label={
                  <Stack spacing={0.25}>
                    <Typography variant="body2" fontWeight={500}>{row.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.description}</Typography>
                  </Stack>
                }
              />
              {i < rows.length - 1 && <Divider sx={{ mt: 1 }} />}
            </Stack>
          ))}

          {status === 'success' && <Alert severity="success">Preferences saved.</Alert>}
          {status === 'error' && <Alert severity="error">Failed to save. Please try again.</Alert>}

          <AppButton
            variant="contained"
            onClick={handleSave}
            disabled={saving || !activeAddress}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {saving ? 'Saving…' : 'Save preferences'}
          </AppButton>

          {!activeAddress && (
            <Typography variant="caption" color="text.secondary">
              Connect your wallet to save preferences.
            </Typography>
          )}
        </Stack>
      </AppCard>
    </AppLayout>
  );
}
