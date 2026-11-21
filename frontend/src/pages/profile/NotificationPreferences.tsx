import {
  Stack,
  Typography,
  Alert,
  Box,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { useState } from 'react';

import { Button } from '../../components/Button';

interface NotificationPrefs {
  emailContributions: boolean;
  emailPayouts: boolean;
  emailGroupUpdates: boolean;
  pushContributions: boolean;
  pushPayouts: boolean;
  pushGroupUpdates: boolean;
  smsAlerts: boolean;
}

const ROWS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: 'emailContributions', label: 'Email — Contributions', description: 'Get notified when a contribution is made in your groups.' },
  { key: 'emailPayouts', label: 'Email — Payouts', description: 'Receive email alerts when a payout is processed.' },
  { key: 'emailGroupUpdates', label: 'Email — Group Updates', description: 'Updates about group membership and settings changes.' },
  { key: 'pushContributions', label: 'Push — Contributions', description: 'Browser push notifications for contributions.' },
  { key: 'pushPayouts', label: 'Push — Payouts', description: 'Browser push notifications for payouts.' },
  { key: 'pushGroupUpdates', label: 'Push — Group Updates', description: 'Browser push notifications for group changes.' },
  { key: 'smsAlerts', label: 'SMS Alerts', description: 'Text message alerts for critical events (requires phone number).' },
];

export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    emailContributions: true,
    emailPayouts: true,
    emailGroupUpdates: false,
    pushContributions: false,
    pushPayouts: true,
    pushGroupUpdates: false,
    smsAlerts: false,
  });
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof NotificationPrefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h3">Notification Preferences</Typography>
      {saved && <Alert severity="success">Notification preferences saved.</Alert>}

      <Stack spacing={1} divider={<Divider />}>
        {ROWS.map(({ key, label, description }) => (
          <Box
            key={key}
            sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}
          >
            <Box>
              <Typography variant="body2" fontWeight={600}>{label}</Typography>
              <Typography variant="caption" color="text.secondary">{description}</Typography>
            </Box>
            <FormControlLabel
              control={<Switch checked={prefs[key]} onChange={() => toggle(key)} size="small" />}
              label=""
              sx={{ m: 0 }}
            />
          </Box>
        ))}
      </Stack>

      <Box>
        <Button variant="primary" onClick={handleSave}>
          Save Preferences
        </Button>
      </Box>
    </Stack>
  );
}
