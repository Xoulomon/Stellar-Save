import { useState } from 'react';
import {
  Button as MuiButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Button } from './Button';
import { useToast } from './Toast/useToast';
import { useContract } from '../hooks/useContract';

export interface TriggerPayoutButtonProps {
  groupId: string;
  /** Called after a successful payout transaction */
  onSuccess?: (txHash: string) => void;
}

export function TriggerPayoutButton({ groupId, onSuccess }: TriggerPayoutButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { executePayout, loading } = useContract();
  const { addToast } = useToast();

  const isPending = loading.executePayout;

  const handleConfirm = async () => {
    setConfirmOpen(false);
    const result = await executePayout({ groupId: BigInt(groupId) });
    if (result.error) {
      addToast({ type: 'error', message: result.error.message || 'Payout failed. Please try again.' });
    } else {
      addToast({ type: 'success', message: `Payout triggered successfully! TX: ${result.txHash}` });
      onSuccess?.(result.txHash!);
    }
  };

  return (
    <>
      <Button
        variant="primary"
        size="large"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
        aria-label="Trigger payout"
      >
        {isPending ? (
          <>
            <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
            Processing…
          </>
        ) : (
          'Trigger Payout'
        )}
      </Button>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Payout</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            All members have contributed this cycle. Triggering the payout will transfer the pooled
            funds to the next recipient on-chain. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <MuiButton variant="contained" color="primary" onClick={handleConfirm}>
            Confirm Payout
          </MuiButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
