import { Alert, Box, Stack, Typography } from '@mui/material';
import { useReducer } from 'react';

import { Button } from './Button';
import { ContributionAmountForm } from './ContributionFlow/ContributionAmountForm';
import { ConfirmDialog } from './ContributionFlow/ConfirmDialog';
import { contributionFlowReducer, createInitialContributionState } from './ContributionFlow/machine';
import { ContributionSuccessModal } from './ContributionSuccessModal';
import { validateContributionAmount } from '../schemas/contributionSchema';
import { getExplorerTxUrl } from '../utils/explorerUrl';

import type { FormEvent } from 'react';
import type { TransactionStatus } from '../types/contribution';

export interface ContributionFlowProps {
  minAmount?: number;
  maxAmount?: number;
  defaultAmount?: number;
  cycleId: number;
  groupName?: string;
  walletAddress?: string;
  onSuccess?: (txHash: string, amount: number) => void;
  onError?: (error: Error) => void;
  disabled?: boolean;
}

async function signAndSubmit(amount: number): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  if (Math.random() < 0.08) throw new Error('User rejected the transaction in wallet.');
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (Math.random() < 0.05) throw new Error('Network error: transaction timed out.');
  return 'tx_' + amount + '_' + Math.random().toString(36).slice(2, 14);
}

const STATUS_LABEL: Partial<Record<TransactionStatus, string>> = {
  pending: 'Signing transaction in wallet...',
  submitting: 'Submitting to Stellar network...',
  success: 'Contribution confirmed!',
  error: 'Transaction failed.',
};

const STATUS_SEVERITY: Partial<Record<TransactionStatus, 'info' | 'success' | 'error'>> = {
  pending: 'info',
  submitting: 'info',
  success: 'success',
  error: 'error',
};

export function ContributionFlow({
  minAmount = 1,
  maxAmount = 100000,
  defaultAmount,
  cycleId,
  groupName,
  walletAddress,
  onSuccess,
  onError,
  disabled = false,
}: ContributionFlowProps) {
  const [state, dispatch] = useReducer(
    contributionFlowReducer,
    defaultAmount,
    createInitialContributionState
  );
  const amount = 'amount' in state ? state.amount : Number.parseFloat(state.amountInput);
  const txHash = state.step === 'success' ? state.txHash : null;
  const status: TransactionStatus =
    state.step === 'error' || state.step === 'success' ? state.step :
    state.step === 'pending' || state.step === 'submitting' ? state.step : 'idle';
  const isProcessing = state.step === 'pending' || state.step === 'submitting';
  const statusSeverity = STATUS_SEVERITY[status];

  const handleSubmitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateContributionAmount(state.amountInput, {
      min: minAmount,
      max: maxAmount,
    });
    if (validationError) {
      dispatch({ type: 'validationFailed', error: validationError });
      return;
    }
    dispatch({ type: 'openConfirmation', amount });
  };

  const handleConfirm = async () => {
    if (state.step !== 'confirming') return;
    const confirmedAmount = state.amount;
    dispatch({ type: 'beginSigning' });
    try {
      const hash = await signAndSubmit(confirmedAmount);
      dispatch({ type: 'beginSubmission' });
      await new Promise((resolve) => setTimeout(resolve, 500));
      dispatch({ type: 'succeeded', txHash: hash });
      onSuccess?.(hash, confirmedAmount);
    } catch (caught) {
      const error = caught instanceof Error ? caught : new Error('Transaction failed');
      dispatch({ type: 'failed', error });
      onError?.(error);
    }
  };

  const handleReset = () => dispatch({ type: 'reset', defaultAmount });

  return (
    <Box>
      {!walletAddress && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Connect your wallet to make a contribution.
        </Alert>
      )}

      {statusSeverity && (
        <Alert
          severity={statusSeverity}
          sx={{ mb: 2 }}
          action={
            status === 'error' ? (
              <Button variant="ghost" size="sm" onClick={() => dispatch({ type: 'retry' })}>
                Retry
              </Button>
            ) : status === 'success' ? (
              <Button variant="ghost" size="sm" onClick={handleReset}>New</Button>
            ) : undefined
          }
        >
          <Stack spacing={0.5}>
            <span>{STATUS_LABEL[status]}</span>
            {txHash && (
              <a href={getExplorerTxUrl(txHash)} target="_blank" rel="noopener noreferrer">
                View on Stellar Explorer →
              </a>
            )}
          </Stack>
        </Alert>
      )}

      {state.step !== 'success' && (
        <ContributionAmountForm
          amountInput={state.amountInput}
          defaultAmount={defaultAmount}
          minAmount={minAmount}
          maxAmount={maxAmount}
          fieldError={state.step === 'editing' ? state.fieldError : null}
          isProcessing={isProcessing}
          canContribute={!!walletAddress && !disabled}
          onAmountChange={(value) => dispatch({ type: 'amountChanged', value })}
          onSubmit={handleSubmitForm}
        />
      )}

      {state.step === 'error' && (
        <Button variant="secondary" onClick={() => dispatch({ type: 'retry' })}>
          Try Again
        </Button>
      )}

      {state.step === 'success' && (
        <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
          <Typography variant="h6" color="success.main">🎉 Contribution Successful!</Typography>
          <Typography variant="body2" color="text.secondary">
            {state.amount} XLM contributed to Cycle #{cycleId}
          </Typography>
          <Button variant="secondary" onClick={handleReset}>Make Another Contribution</Button>
        </Stack>
      )}

      <ConfirmDialog
        open={state.step === 'confirming'}
        amount={state.step === 'confirming' ? state.amount : 0}
        cycleId={cycleId}
        groupName={groupName}
        onConfirm={() => void handleConfirm()}
        onCancel={() => dispatch({ type: 'cancelConfirmation' })}
      />

      <ContributionSuccessModal
        open={state.step === 'success'}
        amount={state.step === 'success' ? state.amount : 0}
        cycleId={cycleId}
        txHash={txHash ?? undefined}
        onClose={handleReset}
      />
    </Box>
  );
}

export default ContributionFlow;
