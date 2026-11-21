import { useCallback, useState } from 'react';

// ── Discriminated union state machine ─────────────────────────────────────────

/** Each state carries only the data relevant to that phase. */
export type TransactionState =
  | { step: 'review' }
  | { step: 'confirm' }
  | { step: 'submitting' }
  | { step: 'success'; txHash: string }
  | { step: 'error'; message: string };

// ── Hook interface ────────────────────────────────────────────────────────────

export interface UseTransactionConfirmationReturn {
  state: TransactionState;
  /** Advance from review → confirm */
  proceedToConfirm: () => void;
  /** Go back from confirm → review */
  goBackToReview: () => void;
  /** Trigger the async submission: confirm → submitting → success | error */
  submit: () => void;
  /** Reset after error: error → review */
  retry: () => void;
  /** Reset the machine to review (used by onClose) */
  reset: () => void;
  /** Whether the modal is in a state that forbids closing */
  isClosePrevented: boolean;
}

const INITIAL_STATE: TransactionState = { step: 'review' };

/**
 * Encapsulates the transaction confirmation state machine.
 *
 * Transitions:
 *   review → confirm      (proceedToConfirm)
 *   confirm → review      (goBackToReview)
 *   confirm → submitting  (submit)
 *   submitting → success  (onConfirm resolves)
 *   submitting → error    (onConfirm rejects)
 *   error → review        (retry)
 *   any → review          (reset)
 *
 * @param onConfirm  Async function that submits the transaction; must resolve
 *                   to a tx hash string or throw on failure.
 * @param onSuccess  Optional callback invoked with the tx hash on success.
 * @param onError    Optional callback invoked with the Error on failure.
 */
export function useTransactionConfirmation(
  onConfirm: () => Promise<string>,
  onSuccess?: (txHash: string) => void,
  onError?: (error: Error) => void,
): UseTransactionConfirmationReturn {
  const [state, setState] = useState<TransactionState>(INITIAL_STATE);

  const proceedToConfirm = useCallback(() => {
    setState({ step: 'confirm' });
  }, []);

  const goBackToReview = useCallback(() => {
    setState({ step: 'review' });
  }, []);

  const submit = useCallback(() => {
    setState({ step: 'submitting' });
    void (async () => {
      try {
        const txHash = await onConfirm();
        setState({ step: 'success', txHash });
        onSuccess?.(txHash);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Transaction failed');
        setState({ step: 'error', message: error.message });
        onError?.(error);
      }
    })();
  }, [onConfirm, onSuccess, onError]);

  const retry = useCallback(() => {
    setState({ step: 'review' });
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const isClosePrevented = state.step === 'submitting';

  return {
    state,
    proceedToConfirm,
    goBackToReview,
    submit,
    retry,
    reset,
    isClosePrevented,
  };
}
