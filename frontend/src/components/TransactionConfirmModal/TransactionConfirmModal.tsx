import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Box,
  Typography,
  Divider,
  Alert,
  CircularProgress,
  Chip,
  Stepper,
  Step,
  StepLabel,
  IconButton,
  Collapse,
} from '@mui/material';
import { useState, useCallback } from 'react';

import { Button } from '../Button';
import { useTransactionConfirmation } from '../../hooks/useTransactionConfirmation';
import { getExplorerTxUrl } from '../../utils/explorerUrl';
import { formatAddress } from '../../utils/formatAddress';
import { formatAmount } from '../../utils/formatAmount';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TxType = 'contribute' | 'join' | 'payout' | 'create' | 'custom';

export interface TransactionDetails {
  type: TxType;
  title: string;
  amount?: number;
  estimatedFee?: number;
  from?: string;
  to?: string;
  groupName?: string;
  cycleId?: number;
  extraDetails?: Array<{ label: string; value: string }>;
}

export interface TransactionConfirmModalProps {
  open: boolean;
  transaction: TransactionDetails;
  onConfirm: () => Promise<string>;
  onClose: () => void;
  onSuccess?: (txHash: string) => void;
  onError?: (error: Error) => void;
}

// ── Step labels ───────────────────────────────────────────────────────────────

const STEPS = ['Review', 'Confirm', 'Submit'];

const STEP_INDEX: Record<string, number> = {
  review: 0,
  confirm: 1,
  submitting: 2,
  success: 2,
  error: 2,
};

// ── Type icon ─────────────────────────────────────────────────────────────────

function TxTypeIcon({ type }: { type: TxType }) {
  const icons: Record<TxType, React.ReactNode> = {
    contribute: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    join: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    payout: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    create: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
    custom: (
      <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  };
  return <>{icons[type]}</>;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={500} sx={{ fontFamily: mono ? 'monospace' : undefined, wordBreak: 'break-all', textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  );
}

// ── Review step ───────────────────────────────────────────────────────────────

function ReviewStep({ tx, onEdit, onNext }: { tx: TransactionDetails; onEdit: () => void; onNext: () => void }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const total = (tx.amount ?? 0) + (tx.estimatedFee ?? 0.00001);

  return (
    <Stack spacing={2}>
      <Box sx={{ bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200', borderRadius: 2, p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <TxTypeIcon type={tx.type} />
        </Box>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>{tx.title}</Typography>
          {tx.groupName && <Typography variant="body2" color="text.secondary">{tx.groupName}</Typography>}
          {tx.cycleId !== undefined && <Chip label={`Cycle #${tx.cycleId}`} size="small" sx={{ mt: 0.5 }} />}
        </Box>
      </Box>

      <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
        <Stack spacing={1}>
          {tx.amount !== undefined && <DetailRow label="Amount" value={formatAmount(tx.amount)} />}
          <DetailRow label="Estimated network fee" value={`~${formatAmount(tx.estimatedFee ?? 0.00001, { decimals: 5 })}`} />
          {tx.amount !== undefined && (
            <>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight={700}>Total</Typography>
                <Typography variant="body2" fontWeight={700} color="primary.main">{formatAmount(total)}</Typography>
              </Box>
            </>
          )}
        </Stack>
      </Box>

      {(tx.from || tx.to) && (
        <Box>
          <Box component="button" onClick={() => setShowAdvanced((v) => !v)} sx={{ background: 'none', border: 'none', cursor: 'pointer', color: 'text.secondary', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 0.5, p: 0, mb: 1, '&:hover': { color: 'primary.main' } }} aria-expanded={showAdvanced} aria-controls="tx-advanced-details" aria-label={showAdvanced ? 'Hide transaction details' : 'Show transaction details'}>
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ transform: showAdvanced ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {showAdvanced ? 'Hide' : 'Show'} transaction details
          </Box>
          <Collapse in={showAdvanced} id="tx-advanced-details">
            <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
              <Stack spacing={1}>
                {tx.from && <DetailRow label="From" value={formatAddress(tx.from, { prefixChars: 8, suffixChars: 6 })} mono />}
                {tx.to && <DetailRow label="To (contract)" value={formatAddress(tx.to, { prefixChars: 8, suffixChars: 6 })} mono />}
                {tx.extraDetails?.map((d) => <DetailRow key={d.label} label={d.label} value={d.value} />)}
              </Stack>
            </Box>
          </Collapse>
        </Box>
      )}

      <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
        Your Freighter wallet will prompt you to approve this transaction on the next step.
      </Alert>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onEdit}>Edit</Button>
        <Button variant="primary" onClick={onNext}>Review Transaction →</Button>
      </Box>
    </Stack>
  );
}

// ── Confirm step ──────────────────────────────────────────────────────────────

function ConfirmStep({ tx, onBack, onConfirm }: { tx: TransactionDetails; onBack: () => void; onConfirm: () => void }) {
  const total = (tx.amount ?? 0) + (tx.estimatedFee ?? 0.00001);

  return (
    <Stack spacing={2}>
      <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
        Please review carefully. Blockchain transactions cannot be reversed once submitted.
      </Alert>
      <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
        <Stack spacing={1.5}>
          <DetailRow label="Transaction" value={tx.title} />
          {tx.groupName && <DetailRow label="Group" value={tx.groupName} />}
          {tx.cycleId !== undefined && <DetailRow label="Cycle" value={`#${tx.cycleId}`} />}
          {tx.amount !== undefined && <DetailRow label="Amount" value={formatAmount(tx.amount)} />}
          <DetailRow label="Network fee" value={`~${formatAmount(tx.estimatedFee ?? 0.00001, { decimals: 5 })}`} />
          {tx.from && <DetailRow label="From" value={formatAddress(tx.from)} mono />}
          {tx.to && <DetailRow label="To" value={formatAddress(tx.to)} mono />}
          {tx.extraDetails?.map((d) => <DetailRow key={d.label} label={d.label} value={d.value} />)}
          {tx.amount !== undefined && (
            <>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight={700}>Total cost</Typography>
                <Typography variant="body2" fontWeight={700} color="primary.main">{formatAmount(total)}</Typography>
              </Box>
            </>
          )}
        </Stack>
      </Box>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button variant="secondary" onClick={onBack}>← Back</Button>
        <Button variant="primary" onClick={onConfirm}>Confirm &amp; Sign</Button>
      </Box>
    </Stack>
  );
}

// ── Submitting step ───────────────────────────────────────────────────────────

function SubmittingStep() {
  return (
    <Stack spacing={3} alignItems="center" py={3}>
      <CircularProgress size={56} />
      <Stack spacing={1} alignItems="center">
        <Typography variant="subtitle1" fontWeight={600}>Submitting Transaction</Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Please approve the transaction in your Freighter wallet, then wait for network confirmation.
        </Typography>
      </Stack>
    </Stack>
  );
}

// ── Success step ──────────────────────────────────────────────────────────────

function SuccessStep({ txHash, tx, onClose }: { txHash: string; tx: TransactionDetails; onClose: () => void }) {
  return (
    <Stack spacing={3} alignItems="center" py={2}>
      <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'success.light', color: 'success.dark', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </Box>
      <Stack spacing={1} alignItems="center">
        <Typography variant="h6" fontWeight={700} color="success.main">Transaction Confirmed</Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">{tx.title} was submitted successfully.</Typography>
      </Stack>
      <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2, width: '100%' }}>
        <Stack spacing={1}>
          <DetailRow label="Transaction hash" value={formatAddress(txHash, { prefixChars: 10, suffixChars: 8 })} mono />
          {tx.amount !== undefined && <DetailRow label="Amount" value={formatAmount(tx.amount)} />}
        </Stack>
      </Box>
      <Box component="a" href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer" sx={{ color: 'primary.main', fontSize: '0.875rem', '&:hover': { textDecoration: 'underline' } }}>
        View on Stellar Explorer →
      </Box>
      <Button variant="primary" onClick={onClose}>Done</Button>
    </Stack>
  );
}

// ── Error step ────────────────────────────────────────────────────────────────

function ErrorStep({ error, onRetry, onClose }: { error: string; onRetry: () => void; onClose: () => void }) {
  return (
    <Stack spacing={3} alignItems="center" py={2}>
      <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'error.light', color: 'error.dark', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </Box>
      <Stack spacing={1} alignItems="center">
        <Typography variant="h6" fontWeight={700} color="error.main">Transaction Failed</Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center">{error}</Typography>
      </Stack>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={onRetry}>Try Again</Button>
      </Box>
    </Stack>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export function TransactionConfirmModal({
  open,
  transaction,
  onConfirm,
  onClose,
  onSuccess,
  onError,
}: TransactionConfirmModalProps) {
  const {
    state,
    proceedToConfirm,
    goBackToReview,
    submit,
    retry,
    reset,
    isClosePrevented,
  } = useTransactionConfirmation(onConfirm, onSuccess, onError);

  const handleClose = useCallback(() => {
    if (isClosePrevented) return;
    reset();
    onClose();
  }, [isClosePrevented, reset, onClose]);

  const activeStep = STEP_INDEX[state.step] ?? 0;
  const showStepper = state.step !== 'success' && state.step !== 'error';

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="tx-confirm-title"
      disableEscapeKeyDown={isClosePrevented}
    >
      <DialogTitle id="tx-confirm-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>
          {state.step === 'success'
            ? 'Transaction Successful'
            : state.step === 'error'
              ? 'Transaction Failed'
              : 'Confirm Transaction'}
        </Typography>
        {!isClosePrevented && (
          <IconButton onClick={handleClose} size="small" aria-label="Close dialog">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </IconButton>
        )}
      </DialogTitle>

      {showStepper && (
        <Box sx={{ px: 3, pb: 1 }}>
          <Stepper activeStep={activeStep} alternativeLabel>
            {STEPS.map((label) => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>
        </Box>
      )}

      <DialogContent sx={{ pt: 2 }}>
        {state.step === 'review' && (
          <ReviewStep tx={transaction} onEdit={handleClose} onNext={proceedToConfirm} />
        )}
        {state.step === 'confirm' && (
          <ConfirmStep tx={transaction} onBack={goBackToReview} onConfirm={submit} />
        )}
        {state.step === 'submitting' && <SubmittingStep />}
        {state.step === 'success' && (
          <SuccessStep txHash={state.txHash} tx={transaction} onClose={handleClose} />
        )}
        {state.step === 'error' && (
          <ErrorStep error={state.message} onRetry={retry} onClose={handleClose} />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }} />
    </Dialog>
  );
}

export default TransactionConfirmModal;
