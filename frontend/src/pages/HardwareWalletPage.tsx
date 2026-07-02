import { useState, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import { Button } from '../components/Button';
import { AppLayout } from '../ui/layout/AppLayout';
import { HardwareWalletManage } from '../components/HardwareWalletManage';
import { HardwareWalletSetup } from '../components/HardwareWalletSetup';
import { HardwareTxConfirm } from '../components/HardwareTxConfirm';
import { useWallet } from '../hooks/useWallet';
import type { HardwareWalletState, TxApprovalRequest } from '../wallet/hardware/types';
import { createInitialState, buildApprovalRequest } from '../wallet/hardware/hardwareService';
import { signWithHardwareWallet } from '../wallet/hardware/hardwareService';

export default function HardwareWalletPage() {
  const { activeAddress } = useWallet();
  const [tab, setTab] = useState(0);
  const [walletState, setWalletState] = useState<HardwareWalletState>(createInitialState);
  const [txRequest, setTxRequest] = useState<TxApprovalRequest | null>(null);
  const [txConfirmOpen, setTxConfirmOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);

  const navItems = useMemo(() => [], []);

  const handleSignDemo = () => {
    const req = buildApprovalRequest(
      'Contribute to Savings Circle',
      'AAAAAgAAA...',
      'TESTNET',
      '0.00012 XLM',
      [{ type: 'contract_call', summary: 'contribute(group: 1, amount: 100)' }],
    );
    setTxRequest(req);
    setTxConfirmOpen(true);
  };

  const handleTxSign = async () => {
    if (!walletState.device) return;
    const req = txRequest!;
    try {
      await signWithHardwareWallet(req, walletState.device, (status) => {
        setTxRequest(prev => prev ? { ...prev, status } : null);
      });
    } catch {
      setTxRequest(prev => prev ? { ...prev, status: 'error' } : null);
    }
  };

  const handleSetupComplete = () => {
    setSetupOpen(false);
    setWalletState(prev => ({ ...prev, status: 'connected' }));
  };

  return (
    <AppLayout title="Hardware Wallet" subtitle="Manage Ledger and Trezor devices" navItems={navItems}>
      <Container maxWidth="md" sx={{ py: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Hardware Wallet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Connect a Ledger or Trezor device for enhanced security. Transactions require physical confirmation on your device.
          </Typography>
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Device Management" />
          <Tab label="Test Signing" />
        </Tabs>

        {tab === 0 && (
          <HardwareWalletManage state={walletState} onStateChange={setWalletState} />
        )}

        {tab === 1 && (
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Test Transaction Signing
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Send a test transaction to your hardware wallet to verify the signing flow works.
                </Typography>

                <Stack spacing={1} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Wallet Status</Typography>
                    <Chip
                      label={walletState.status === 'connected' ? 'Connected' : 'Not Connected'}
                      color={walletState.status === 'connected' ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Device</Typography>
                    <Typography variant="body2">{walletState.device?.name || 'None'}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Account</Typography>
                    <Typography variant="body2">
                      {walletState.selectedAccount?.label || 'None selected'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Wallet (Web)</Typography>
                    <Typography variant="body2">{activeAddress || 'Not connected'}</Typography>
                  </Box>
                </Stack>

                {walletState.status !== 'connected' && (
                  <Button variant="primary" size="sm" onClick={() => setSetupOpen(true)}>
                    Connect Hardware Wallet
                  </Button>
                )}
              </CardContent>
            </Card>

            {walletState.status === 'connected' && walletState.device && (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Button variant="primary" size="lg" onClick={handleSignDemo}>
                  Test Sign Transaction on {walletState.device.name}
                </Button>
              </Box>
            )}
          </Stack>
        )}

        <HardwareTxConfirm
          open={txConfirmOpen}
          onClose={() => setTxConfirmOpen(false)}
          request={txRequest}
          walletState={walletState}
          onSign={handleTxSign}
        />

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
      </Container>
    </AppLayout>
  );
}
