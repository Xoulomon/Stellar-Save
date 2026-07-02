import { useState, useCallback } from 'react';
import {
  Box,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  Divider,
  Chip,
} from '@mui/material';
import { Button } from './Button';
import type { TxApprovalRequest, TxApprovalStatus, HardwareWalletState } from '../wallet/hardware/types';
import { HARDWARE_WALLET_I18N } from '../wallet/hardware/types';

interface HardwareTxConfirmProps {
  open: boolean;
  onClose: () => void;
  request: TxApprovalRequest | null;
  walletState: HardwareWalletState;
  onSign: () => Promise<void>;
}

export function HardwareTxConfirm({ open, onClose, request, walletState, onSign }: HardwareTxConfirmProps) {
  const [status, setStatus] = useState<TxApprovalStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (status === 'pending_device') return;
    setStatus('idle');
    setError(null);
    onClose();
  }, [status, onClose]);

  const handleSign = useCallback(async () => {
    setError(null);
    try {
      await onSign();
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Signing failed');
    }
  }, [onSign]);

  const steps = ['Review', 'Confirm on Device', 'Complete'];
  let activeStep = 0;
  if (status === 'pending_device') activeStep = 1;
  if (status === 'approved') activeStep = 2;
  if (status === 'error') activeStep = 1;

  if (!request) return null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth disableEscapeKeyDown={status === 'pending_device'}>
      <DialogTitle>
        <Typography variant="h6" fontWeight={700}>
          Hardware Wallet Confirmation
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
          </Stepper>

          {status === 'idle' && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
                Review the transaction details below, then confirm on your {walletState.device?.name || 'hardware device'}.
              </Alert>

              <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Transaction</Typography>
                    <Typography variant="body2" fontWeight={600}>{request.title}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Network</Typography>
                    <Chip label={request.network} size="small" variant="outlined" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">Fee</Typography>
                    <Typography variant="body2" fontWeight={600}>{request.fee}</Typography>
                  </Box>
                  <Divider />
                  <Typography variant="body2" fontWeight={600}>Operations ({request.operations.length})</Typography>
                  {request.operations.map((op, i) => (
                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', pl: 1 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {i + 1}. {op.type}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{op.summary}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              {walletState.device && (
                <Box sx={{ bgcolor: 'info.50', borderRadius: 2, p: 2, border: '1px solid', borderColor: 'info.200' }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ fontSize: '1.2rem' }}>🔒</Box>
                    <Stack>
                      <Typography variant="body2" fontWeight={600}>
                        Signing with {walletState.device.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Make sure your device is unlocked and the Stellar app is open.
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              )}
            </Stack>
          )}

          {status === 'pending_device' && (
            <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
              <CircularProgress size={48} />
              <Typography variant="subtitle1" fontWeight={600}>Check Your Hardware Device</Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                Please review and approve the transaction on your {walletState.device?.name || 'device'}.
                <br />
                The screen will update once confirmed.
              </Typography>
              {walletState.device?.type === 'ledger' && (
                <Alert severity="info" sx={{ fontSize: '0.8rem', width: '100%' }}>
                  On your Ledger: Navigate to the Stellar app, review the operation, press both buttons to sign.
                </Alert>
              )}
              {walletState.device?.type === 'trezor' && (
                <Alert severity="info" sx={{ fontSize: '0.8rem', width: '100%' }}>
                  On your Trezor: Review the transaction details on screen, press Confirm to sign.
                </Alert>
              )}
            </Stack>
          )}

          {status === 'approved' && (
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
              <Typography variant="h6" fontWeight={700} color="success.main">Transaction Signed</Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                The transaction was approved and signed by your hardware device.
              </Typography>
            </Stack>
          )}

          {status === 'rejected' && (
            <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
              <Box sx={{
                width: 56, height: 56, borderRadius: '50%',
                bgcolor: 'warning.light', color: 'warning.dark',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Box>
              <Typography variant="h6" fontWeight={700} color="warning.main">Transaction Rejected</Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                The transaction was rejected on your hardware device.
              </Typography>
            </Stack>
          )}

          {status === 'error' && error && (
            <Alert severity="error" sx={{ fontSize: '0.85rem' }}>{error}</Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {status === 'idle' && (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSign}>
              Sign with {walletState.device?.name || 'Hardware Wallet'}
            </Button>
          </>
        )}
        {status === 'approved' && (
          <Button variant="primary" onClick={handleClose}>Done</Button>
        )}
        {(status === 'rejected' || status === 'error') && (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSign}>Try Again</Button>
          </>
        )}
        {status === 'pending_device' && (
          <Button variant="secondary" onClick={handleClose} disabled>Waiting for device...</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
