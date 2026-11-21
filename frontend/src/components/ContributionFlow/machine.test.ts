import { describe, expect, it } from 'vitest';

import {
  contributionFlowReducer,
  createInitialContributionState,
  type ContributionFlowEvent,
  type ContributionFlowState,
} from './machine';

const validationError = { key: 'contribution.invalid', defaultMessage: 'Invalid amount' };

function transition(state: ContributionFlowState, ...events: ContributionFlowEvent[]) {
  return events.reduce(contributionFlowReducer, state);
}

describe('contributionFlowReducer', () => {
  it('allows editing, validation, confirmation, cancellation, and retry', () => {
    const initial = createInitialContributionState(25);
    const edited = contributionFlowReducer(initial, { type: 'amountChanged', value: '30' });
    expect(edited).toEqual({ step: 'editing', amountInput: '30', fieldError: null });

    const invalid = contributionFlowReducer(edited, { type: 'validationFailed', error: validationError });
    expect(invalid).toEqual({ step: 'editing', amountInput: '30', fieldError: validationError });

    const confirming = contributionFlowReducer(invalid, { type: 'openConfirmation', amount: 30 });
    expect(confirming).toEqual({ step: 'confirming', amountInput: '30', amount: 30 });
    expect(contributionFlowReducer(confirming, { type: 'cancelConfirmation' })).toEqual(edited);
  });

  it('allows a complete transaction from confirmation through success', () => {
    const succeeded = transition(createInitialContributionState(),
      { type: 'amountChanged', value: '42' },
      { type: 'openConfirmation', amount: 42 },
      { type: 'beginSigning' },
      { type: 'beginSubmission' },
      { type: 'succeeded', txHash: 'tx-42' }
    );
    expect(succeeded).toEqual({ step: 'success', amountInput: '42', amount: 42, txHash: 'tx-42' });
    expect(contributionFlowReducer(succeeded, { type: 'reset', defaultAmount: 10 })).toEqual(
      createInitialContributionState(10)
    );
  });

  it('allows failure from an in-flight step and retry back to editing', () => {
    const pending = transition(createInitialContributionState(),
      { type: 'openConfirmation', amount: 7 },
      { type: 'beginSigning' }
    );
    const error = new Error('request failed');
    const failed = contributionFlowReducer(pending, { type: 'failed', error });
    expect(failed).toEqual({ step: 'error', amountInput: '', amount: 7, error });
    expect(contributionFlowReducer(failed, { type: 'retry' })).toEqual({
      step: 'editing', amountInput: '', fieldError: null,
    });
  });

  it('ignores every event that is invalid for the current step', () => {
    const editing = createInitialContributionState();
    const confirming = contributionFlowReducer(editing, { type: 'openConfirmation', amount: 1 });
    const pending = contributionFlowReducer(confirming, { type: 'beginSigning' });
    const submitting = contributionFlowReducer(pending, { type: 'beginSubmission' });
    const succeeded = contributionFlowReducer(submitting, { type: 'succeeded', txHash: 'tx-1' });
    const failed = contributionFlowReducer(pending, { type: 'failed', error: new Error('failed') });
    const states = [editing, confirming, pending, submitting, succeeded, failed];
    const allEvents: ContributionFlowEvent[] = [
      { type: 'amountChanged', value: '2' },
      { type: 'validationFailed', error: validationError },
      { type: 'openConfirmation', amount: 2 },
      { type: 'cancelConfirmation' },
      { type: 'beginSigning' },
      { type: 'beginSubmission' },
      { type: 'succeeded', txHash: 'unexpected' },
      { type: 'failed', error: new Error('unexpected') },
      { type: 'retry' },
      { type: 'reset' },
    ];
    const allowedByStep: Record<ContributionFlowState['step'], string[]> = {
      editing: ['amountChanged', 'validationFailed', 'openConfirmation', 'reset'],
      confirming: ['cancelConfirmation', 'beginSigning', 'reset'],
      pending: ['beginSubmission', 'failed', 'reset'],
      submitting: ['succeeded', 'failed', 'reset'],
      success: ['reset'],
      error: ['retry', 'reset'],
    };

    for (const state of states) {
      for (const event of allEvents) {
        if (!allowedByStep[state.step].includes(event.type)) {
          expect(contributionFlowReducer(state, event)).toBe(state);
        }
      }
    }
  });
});
