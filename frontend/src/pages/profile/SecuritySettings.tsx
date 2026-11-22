import {
  Stack,
  Typography,
  Alert,
  Box,
  Divider,
  Switch,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { useState } from 'react';

import { Button } from '../../components/Button';
import { useWallet } from '../../hooks/useWallet';
import { AppCard } from '../../ui';

export function SecuritySettings() {
  const { activeAddress, network } = useWallet();
  const [twoFactor, setTwoFactor] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Stack spacing={3}>
      <Typography variant="h3">Security Settings</Typography>
      {saved && <Alert severity="success">Security settings updated.</Alert>}

      {/* Connected wallet info */}
      <AppCard>
        <Stack spacing={1.5}>
          <Typography variant="body1" fontWeight={600}>Connected Wallet</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Address</Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
              {activeAddress ?? 'Not connected'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Network</Typography>
            <Chip
              label={network ?? 'Unknown'}
              size="small"
              color={network === 'PUBLIC' ? 'success' : 'warning'}
            />
          </Box>
        </Stack>
      </AppCard>

      {/* 2FA toggle */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="body2" fontWeight={600}>Two-Factor Authentication</Typography>
          <Typography variant="caption" color="text.secondary">
            Add an extra layer of security to your account.
          </Typography>
        </Box>
        <Switch
          checked={twoFactor}
          onChange={() => setTwoFactor((v) => !v)}
          inputProps={{ 'aria-label': 'Toggle two-factor authentication' }}
        />
      </Box>

      {twoFactor && (
        <Alert severity="info">
          2FA setup would require scanning a QR code with an authenticator app. (Demo only)
        </Alert>
      )}

      {/* Session timeout */}
      <FormControl fullWidth size="small">
        <InputLabel>Session Timeout</InputLabel>
        <Select value={sessionTimeout} label="Session Timeout" onChange={(e) => setSessionTimeout(e.target.value)}>
          <MenuItem value="15">15 minutes</MenuItem>
          <MenuItem value="30">30 minutes</MenuItem>
          <MenuItem value="60">1 hour</MenuItem>
          <MenuItem value="240">4 hours</MenuItem>
          <MenuItem value="0">Never</MenuItem>
        </Select>
      </FormControl>

      <Divider />

      <Alert severity="warning">
        Revoking wallet access will disconnect your wallet and clear all session data.
      </Alert>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="primary" onClick={handleSave}>Save Security Settings</Button>
        <Button variant="secondary">Revoke Wallet Access</Button>
      </Box>
    </Stack>
  );
}
