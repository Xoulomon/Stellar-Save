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
import { useTransaction, explorerUrl } from '../hooks/useTransaction';

export interface TriggerPayoutButtonProps {
  groupId: string;
  onSuccess?: (txHash: string) => void;
}

export function TriggerPayoutButton({ groupId, onSuccess }: TriggerPayoutButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { executePayout } = useContract();
  const { state, txHash, error, execute } = useTransaction();
  const { addToast } = useToast();

  const isPending = state === 'pending';

  const handleConfirm = async () => {
    setConfirmOpen(false);
    await execute(async () => {
      const result = await executePayout({ groupId: BigInt(groupId) });
      if (result.error) throw new Error(result.error.message);
      return result.txHash!;
    });
  };

  // Show toast after state settles
  if (state === 'confirmed' && txHash) {
    addToast({ type: 'success', message: `Payout triggered! TX: ${txHash}`, duration: 5000 });
    onSuccess?.(txHash);
  } else if (state === 'failed' && error) {
    addToast({ type: 'error', message: error });
  }

  return (
    <>
      <Button
        variant="primary"
        size="lg"
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

      {state === 'confirmed' && txHash && (
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          <a href={explorerUrl(txHash)} target="_blank" rel="noopener noreferrer">
            View on Explorer →
          </a>
        </Typography>
      )}

      {state === 'failed' && error && (
        <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
          {error}
        </Typography>
      )}

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
