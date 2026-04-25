import { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Divider,
  Chip,
} from '@mui/material';
import { Button } from './Button';
import { ContributionSuccessModal } from './ContributionSuccessModal';
import type { TransactionStatus } from '../types/contribution';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ContributionFlowProps {
  /** Minimum allowed contribution in XLM */
  minAmount?: number;
  /** Maximum allowed contribution in XLM */
  maxAmount?: number;
  /** Pre-filled amount (e.g. from group settings) */
  defaultAmount?: number;
  /** Current cycle number */
  cycleId: number;
  /** Connected wallet address */
  walletAddress?: string;
  /** Called with tx hash on success */
  onSuccess?: (txHash: string, amount: number) => void;
  /** Called on terminal error */
  onError?: (error: Error) => void;
  /** Disable the trigger button */
  disabled?: boolean;
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateAmount(raw: string, min: number, max: number): string | null {
  const value = parseFloat(raw);
  if (!raw.trim() || isNaN(value)) return 'Please enter a valid amount.';
  if (value <= 0) return 'Amount must be greater than 0.';
  if (value < min) return `Minimum contribution is ${min} XLM.`;
  if (value > max) return `Maximum contribution is ${max} XLM.`;
  return null;
}

// ── Mock wallet transaction ──────────────────────────────────────────────────

async function signAndSubmit(amount: number): Promise<string> {
  // Step 1: wallet signing (simulated)
  await new Promise((r) => setTimeout(r, 1200));
  if (Math.random() < 0.08) throw new Error('User rejected the transaction in wallet.');
  // Step 2: network submission
  await new Promise((r) => setTimeout(r, 900));
  if (Math.random() < 0.05) throw new Error('Network error: transaction timed out.');
  return `tx_${amount}_${Math.random().toString(36).slice(2, 14)}`;
}

// ── Status display config ────────────────────────────────────────────────────

const STATUS_LABEL: Record<TransactionStatus, string> = {
  idle: '',
  confirming: 'Waiting for your confirmation...',
  pending: 'Signing transaction in wallet...',
  submitting: 'Submitting to Stellar network...',
  success: 'Contribution confirmed!',
  error: 'Transaction failed.',
};

const STATUS_SEVERITY: Partial<Record<TransactionStatus, 'info' | 'success' | 'error' | 'warning'>> = {
  confirming: 'info',
  pending: 'info',
  submitting: 'info',
  success: 'success',
  error: 'error',
};

// ── Confirmation Dialog ──────────────────────────────────────────────────────

interface ConfirmDialogProps {
  open: boolean;
  amount: number;
  cycleId: number;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ open, amount, cycleId, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Confirm Contribution</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Cycle #{cycleId}
          </Typography>
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Amount</Typography>
                <Typography variant="body2" fontWeight={700}>{amount} XLM</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Network fee</Typography>
                <Typography variant="body2" color="text.secondary">~0.00001 XLM</Typography>
              </Box>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight={600}>Total</Typography>
                <Typography variant="body2" fontWeight={700} color="primary">{amount} XLM</Typography>
              </Box>
            </Stack>
          </Box>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Your wallet will prompt you to approve this transaction.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm}>Confirm &amp; Sign</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

/**
 * ContributionFlow — Issue #442
 * Full user flow for making contributions:
 * - Contribution amount form with validation
 * - Confirmation dialog
 * - Wallet signing simulation
 * - Transaction status display
 * - Success / error messages
 * - Retry functionality
 */
export function ContributionFlow({
  minAmount = 1,
  maxAmount = 100000,
  defaultAmount,
  cycleId,
  walletAddress,
  onSuccess,
  onError,
  disabled = false,
}: ContributionFlowProps) {
  const [amountInput, setAmountInput] = useState(defaultAmount ? String(defaultAmount) : '');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState<TransactionStatus>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const isProcessing = ['confirming', 'pending', 'submitting'].includes(status);
  const parsedAmount = parseFloat(amountInput);

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateAmount(amountInput, minAmount, maxAmount);
    if (err) { setFieldError(err); return; }
    setFieldError(null);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    setStatus('confirming');
    setErrorMessage(null);
    setTxHash(null);
    try {
      setStatus('pending');
      const hash = await signAndSubmit(parsedAmount);
      setStatus('submitting');
      await new Promise((r) => setTimeout(r, 500));
      setTxHash(hash);
      setStatus('success');
      setShowSuccess(true);
      onSuccess?.(hash, parsedAmount);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Transaction failed');
      setErrorMessage(error.message);
      setStatus('error');
      onError?.(error);
    }
  };

  const handleRetry = () => {
    setStatus('idle');
    setErrorMessage(null);
    setTxHash(null);
  };

  const handleReset = () => {
    setStatus('idle');
    setAmountInput(defaultAmount ? String(defaultAmount) : '');
    setFieldError(null);
    setErrorMessage(null);
    setTxHash(null);
    setShowSuccess(false);
  };

  const statusSeverity = STATUS_SEVERITY[status];

  return (
    <Box>
      {/* Wallet not connected warning */}
      {!walletAddress && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Connect your wallet to make a contribution.
        </Alert>
      )}

      {/* Transaction status banner */}
      {statusSeverity && STATUS_LABEL[status] && (
        <Alert
          severity={statusSeverity}
          sx={{ mb: 2 }}
          action={
            status === 'error' ? (
              <Button variant="ghost" size="sm" onClick={handleRetry}>Retry</Button>
            ) : status === 'success' ? (
              <Button variant="ghost" size="sm" onClick={handleReset}>New</Button>
            ) : undefined
          }
        >
          <Stack spacing={0.5}>
            <span>{STATUS_LABEL[status]}</span>
            {txHash && status === 'success' && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '0.75rem', color: 'inherit' }}
              >
                View on Stellar Explorer →
              </a>
            )}
          </Stack>
        </Alert>
      )}

      {/* Contribution form — hidden while processing or after success */}
      {status !== 'success' && (
        <Box component="form" onSubmit={handleSubmitForm} noValidate>
          <Stack spacing={2}>
            <TextField
              label="Contribution Amount (XLM)"
              type="number"
              value={amountInput}
              onChange={(e) => { setAmountInput(e.target.value); setFieldError(null); }}
              error={!!fieldError}
              helperText={fieldError ?? `Min: ${minAmount} XLM · Max: ${maxAmount.toLocaleString()} XLM`}
              inputProps={{ min: minAmount, max: maxAmount, step: '0.01' }}
              disabled={isProcessing || !walletAddress || disabled}
              fullWidth
              size="small"
            />

            {/* Amount quick-select chips */}
            {defaultAmount && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {[defaultAmount * 0.5, defaultAmount, defaultAmount * 2].map((v) => (
                  <Chip
                    key={v}
                    label={`${v} XLM`}
                    size="small"
                    variant={parseFloat(amountInput) === v ? 'filled' : 'outlined'}
                    color={parseFloat(amountInput) === v ? 'primary' : 'default'}
                    onClick={() => { setAmountInput(String(v)); setFieldError(null); }}
                    disabled={isProcessing || !walletAddress || disabled}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                type="submit"
                variant="primary"
                disabled={isProcessing || !walletAddress || disabled}
              >
                {isProcessing ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={16} color="inherit" />
                    Processing...
                  </Box>
                ) : 'Contribute'}
              </Button>
              {status === 'error' && (
                <Button variant="secondary" onClick={handleRetry}>Try Again</Button>
              )}
            </Box>
          </Stack>
        </Box>
      )}

      {/* Success state */}
      {status === 'success' && (
        <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
          <Typography variant="h6" color="success.main">🎉 Contribution Successful!</Typography>
          <Typography variant="body2" color="text.secondary">
            {parsedAmount} XLM contributed to Cycle #{cycleId}
          </Typography>
          <Button variant="secondary" onClick={handleReset}>Make Another Contribution</Button>
        </Stack>
      )}

      {/* Confirmation dialog */}
      <ConfirmDialog
        open={confirmOpen}
        amount={parsedAmount || 0}
        cycleId={cycleId}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Success animation modal */}
      <ContributionSuccessModal
        open={showSuccess}
        amount={parsedAmount || 0}
        cycleId={cycleId}
        txHash={txHash ?? undefined}
        onClose={handleReset}
      />
    </Box>
  );
}

export default ContributionFlow;
