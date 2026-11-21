import type { ValidationMessage } from '../../schemas/contributionSchema';

export type ContributionFlowState =
  | { step: 'editing'; amountInput: string; fieldError: ValidationMessage | null }
  | { step: 'confirming'; amountInput: string; amount: number }
  | { step: 'pending'; amountInput: string; amount: number }
  | { step: 'submitting'; amountInput: string; amount: number }
  | { step: 'success'; amountInput: string; amount: number; txHash: string }
  | { step: 'error'; amountInput: string; amount: number; error: Error };

export type ContributionFlowEvent =
  | { type: 'amountChanged'; value: string }
  | { type: 'validationFailed'; error: ValidationMessage }
  | { type: 'openConfirmation'; amount: number }
  | { type: 'cancelConfirmation' }
  | { type: 'beginSigning' }
  | { type: 'beginSubmission' }
  | { type: 'succeeded'; txHash: string }
  | { type: 'failed'; error: Error }
  | { type: 'retry' }
  | { type: 'reset'; defaultAmount?: number };

export function createInitialContributionState(defaultAmount?: number): ContributionFlowState {
  return {
    step: 'editing',
    amountInput: defaultAmount ? String(defaultAmount) : '',
    fieldError: null,
  };
}

/** Transition only on events valid for the current step; stale events are ignored. */
export function contributionFlowReducer(
  state: ContributionFlowState,
  event: ContributionFlowEvent
): ContributionFlowState {
  switch (event.type) {
    case 'amountChanged':
      return state.step === 'editing'
        ? { ...state, amountInput: event.value, fieldError: null }
        : state;
    case 'validationFailed':
      return state.step === 'editing' ? { ...state, fieldError: event.error } : state;
    case 'openConfirmation':
      return state.step === 'editing'
        ? { step: 'confirming', amountInput: state.amountInput, amount: event.amount }
        : state;
    case 'cancelConfirmation':
      return state.step === 'confirming'
        ? { step: 'editing', amountInput: state.amountInput, fieldError: null }
        : state;
    case 'beginSigning':
      return state.step === 'confirming'
        ? { step: 'pending', amountInput: state.amountInput, amount: state.amount }
        : state;
    case 'beginSubmission':
      return state.step === 'pending'
        ? { step: 'submitting', amountInput: state.amountInput, amount: state.amount }
        : state;
    case 'succeeded':
      return state.step === 'submitting'
        ? { step: 'success', amountInput: state.amountInput, amount: state.amount, txHash: event.txHash }
        : state;
    case 'failed':
      return state.step === 'pending' || state.step === 'submitting'
        ? { step: 'error', amountInput: state.amountInput, amount: state.amount, error: event.error }
        : state;
    case 'retry':
      return state.step === 'error'
        ? { step: 'editing', amountInput: state.amountInput, fieldError: null }
        : state;
    case 'reset':
      return createInitialContributionState(event.defaultAmount);
  }
}
