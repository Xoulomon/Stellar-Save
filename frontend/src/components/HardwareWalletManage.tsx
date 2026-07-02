import { useState, useCallback } from 'react';
import {
  Box,
  Stack,
  Typography,
  Card,
  CardContent,
  Divider,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import { Button } from './Button';
import { HardwareWalletSetup } from './HardwareWalletSetup';
import type { HardwareAccount, HardwareDeviceInfo, HardwareWalletState } from '../wallet/hardware/types';
import { HARDWARE_WALLET_I18N } from '../wallet/hardware/types';
import { disconnectDevice, updatePersistedState } from '../wallet/hardware/hardwareService';

interface HardwareWalletManageProps {
  state: HardwareWalletState;
  onStateChange: (state: HardwareWalletState) => void;
}

export function HardwareWalletManage({ state, onStateChange }: HardwareWalletManageProps) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<HardwareAccount | null>(null);

  const handleDisconnect = useCallback(async () => {
    await disconnectDevice();
    onStateChange({
      type: null,
      status: 'disconnected',
      device: null,
      accounts: [],
      selectedAccount: null,
      error: null,
    });
  }, [onStateChange]);

  const handleSelectAccount = useCallback((account: HardwareAccount) => {
    setSelectedAccount(account);
    updatePersistedState({ selectedAccount: account });
    onStateChange({ ...state, selectedAccount: account });
  }, [state, onStateChange]);

  const handleSetupComplete = useCallback(() => {
    setSetupOpen(false);
    onStateChange({ ...state, status: 'connected' });
  }, [state, onStateChange]);

  if (!state.device && state.accounts.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" gutterBottom color="text.secondary">
          No hardware wallet connected
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Connect a Ledger or Trezor device to manage your accounts and sign transactions securely.
        </Typography>
        <Button variant="primary" onClick={() => setSetupOpen(true)}>
          + Connect Hardware Wallet
        </Button>

        <Dialog open={setupOpen} onClose={() => setSetupOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Typography variant="h6" fontWeight={700}>Setup Hardware Wallet</Typography>
          </DialogTitle>
          <DialogContent>
            <HardwareWalletSetup
              onComplete={handleSetupComplete}
              onCancel={() => setSetupOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {/* Device Info */}
      {state.device && (
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Stack>
                <Typography variant="subtitle2" fontWeight={700}>{state.device.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {HARDWARE_WALLET_I18N[state.device.type]} · {HARDWARE_WALLET_I18N[state.device.connection]}
                  {state.device.firmwareVersion && ` · FW ${state.device.firmwareVersion}`}
                </Typography>
              </Stack>
              <Stack alignItems="flex-end">
                <Chip
                  label={state.status === 'connected' ? 'Connected' : 'Disconnected'}
                  color={state.status === 'connected' ? 'success' : 'default'}
                  size="small"
                />
                {state.device.batteryLevel !== undefined && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    {state.device.batteryLevel}% battery
                  </Typography>
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Accounts */}
      <Typography variant="subtitle2" fontWeight={700}>Accounts</Typography>
      {state.accounts.map((account, i) => (
        <Card
          key={account.index}
          variant="outlined"
          sx={{
            cursor: 'pointer',
            borderColor: selectedAccount?.index === account.index ? 'primary.main' : undefined,
            bgcolor: selectedAccount?.index === account.index ? 'action.selected' : undefined,
            '&:hover': { borderColor: 'primary.light' },
          }}
          onClick={() => handleSelectAccount(account)}
        >
          <CardContent sx={{ py: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Stack>
                <Typography variant="body2" fontWeight={600}>
                  {account.label || `Account ${account.index + 1}`}
                </Typography>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                  {account.address.slice(0, 12)}...{account.address.slice(-8)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                  {account.path}
                </Typography>
              </Stack>
              {selectedAccount?.index === account.index && (
                <Chip label="Selected" size="small" color="primary" />
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Divider />

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between' }}>
        <Button variant="secondary" size="sm" onClick={() => setSetupOpen(true)}>
          Change Device
        </Button>
        <Button variant="danger" size="sm" onClick={handleDisconnect}>
          Disconnect
        </Button>
      </Box>

      <Dialog open={setupOpen} onClose={() => setSetupOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Typography variant="h6" fontWeight={700}>Change Hardware Wallet</Typography>
        </DialogTitle>
        <DialogContent>
          <HardwareWalletSetup
            onComplete={handleSetupComplete}
            onCancel={() => setSetupOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
