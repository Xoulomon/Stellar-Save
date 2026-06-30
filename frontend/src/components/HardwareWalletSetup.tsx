import { useState, useCallback } from 'react';
import {
  Box,
  Stack,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Radio,
  RadioGroup,
  FormControlLabel,
} from '@mui/material';
import { Button } from './Button';
import type { HardwareWalletType, HardwareDeviceInfo, ConnectionStatus } from '../wallet/hardware/types';
import { HARDWARE_WALLET_I18N } from '../wallet/hardware/types';
import { scanForDevices, connectToDevice, fetchAccounts, updatePersistedState } from '../wallet/hardware/hardwareService';

interface HardwareWalletSetupProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function HardwareWalletSetup({ onComplete, onCancel }: HardwareWalletSetupProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedType, setSelectedType] = useState<HardwareWalletType | null>(null);
  const [devices, setDevices] = useState<HardwareDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<HardwareDeviceInfo | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const steps = ['Choose Device', 'Scan & Connect', 'Import Accounts'];

  const handleTypeSelect = (type: HardwareWalletType) => {
    setSelectedType(type);
    setError(null);
  };

  const handleStartScan = useCallback(async () => {
    if (!selectedType) return;
    setStatus('scanning');
    setError(null);
    try {
      const found = await scanForDevices(selectedType);
      setDevices(found);
      if (found.length === 0) {
        setStatus('error');
        setError(`No ${HARDWARE_WALLET_I18N[selectedType]} devices found. Ensure Bluetooth is enabled and the device is unlocked.`);
      } else {
        setActiveStep(1);
        setStatus('disconnected');
      }
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Scan failed');
    }
  }, [selectedType]);

  const handleConnect = useCallback(async () => {
    if (!selectedDevice) return;
    setStatus('connecting');
    setError(null);
    try {
      await connectToDevice(selectedDevice);
      setStatus('connected');
      setActiveStep(2);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [selectedDevice]);

  const handleImport = useCallback(async () => {
    if (!selectedDevice) return;
    try {
      const accounts = await fetchAccounts(selectedDevice);
      updatePersistedState({
        type: selectedType,
        accounts,
        selectedAccount: accounts[0] || null,
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import accounts');
    }
  }, [selectedDevice, selectedType, onComplete]);

  return (
    <Box>
      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 2, fontSize: '0.85rem' }}>{error}</Alert>}

      {activeStep === 0 && (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Select your hardware wallet type to begin the connection process.
          </Typography>
          <RadioGroup value={selectedType || ''} onChange={(e) => handleTypeSelect(e.target.value as HardwareWalletType)}>
            <Card variant="outlined" sx={{ mb: 1, borderColor: selectedType === 'ledger' ? 'primary.main' : undefined }}>
              <CardContent sx={{ py: 1.5 }}>
                <FormControlLabel
                  value="ledger"
                  control={<Radio />}
                  label={
                    <Stack>
                      <Typography variant="body1" fontWeight={600}>Ledger</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Nano S, Nano S Plus, Nano X, Stax
                      </Typography>
                    </Stack>
                  }
                  sx={{ width: '100%', m: 0 }}
                />
              </CardContent>
            </Card>
            <Card variant="outlined" sx={{ borderColor: selectedType === 'trezor' ? 'primary.main' : undefined }}>
              <CardContent sx={{ py: 1.5 }}>
                <FormControlLabel
                  value="trezor"
                  control={<Radio />}
                  label={
                    <Stack>
                      <Typography variant="body1" fontWeight={600}>Trezor</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Model One, Model T, Safe 3, Safe 5
                      </Typography>
                    </Stack>
                  }
                  sx={{ width: '100%', m: 0 }}
                />
              </CardContent>
            </Card>
          </RadioGroup>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleStartScan} disabled={!selectedType}>
              {status === 'scanning' ? 'Scanning...' : 'Scan for Devices'}
            </Button>
          </Box>
        </Stack>
      )}

      {activeStep === 1 && (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            {devices.length} device{devices.length !== 1 ? 's' : ''} found. Select one to connect.
          </Typography>
          {devices.map(device => (
            <Card
              key={device.id}
              variant="outlined"
              sx={{
                cursor: 'pointer',
                borderColor: selectedDevice?.id === device.id ? 'primary.main' : undefined,
                '&:hover': { borderColor: 'primary.light' },
              }}
              onClick={() => setSelectedDevice(device)}
            >
              <CardContent sx={{ py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack>
                    <Typography variant="body2" fontWeight={600}>{device.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {HARDWARE_WALLET_I18N[device.connection]} · FW {device.firmwareVersion}
                    </Typography>
                  </Stack>
                  {device.batteryLevel !== undefined && (
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" fontWeight={600}>
                        {device.batteryLevel}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        Battery
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => { setActiveStep(0); setDevices([]); setSelectedDevice(null); }}>
              Back
            </Button>
            <Button variant="primary" onClick={handleConnect} disabled={!selectedDevice}>
              {status === 'connecting' ? 'Connecting...' : 'Connect'}
            </Button>
          </Box>
        </Stack>
      )}

      {activeStep === 2 && (
        <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
          <Box sx={{
            width: 56, height: 56, borderRadius: '50%',
            bgcolor: 'success.light', color: 'success.dark',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </Box>
          <Typography variant="h6" fontWeight={700} color="success.main">Connected</Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {selectedDevice?.name} connected successfully via {HARDWARE_WALLET_I18N[selectedDevice?.connection || 'ble']}.
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Import accounts to start using your hardware wallet with Stellar Save.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <Button variant="secondary" onClick={onCancel}>Skip</Button>
            <Button variant="primary" onClick={handleImport}>
              Import Accounts
            </Button>
          </Box>
        </Stack>
      )}

      {status === 'connecting' && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
}
