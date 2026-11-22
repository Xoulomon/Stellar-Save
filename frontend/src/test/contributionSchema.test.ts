/**
 * contributionSchema.test.ts
 *
 * Unit coverage for the shared contribution validation rules. These rules
 * previously lived inline in `ContributionFlow` and `ContributionScheduler`,
 * which meant the two forms could drift apart.
 */
import { describe, it, expect } from 'vitest';

import en from '../i18n/locales/en.json';
import { VALIDATION_CONSTANTS } from '../schemas/groupSchema';
import {
  DEFAULT_CONTRIBUTION_LIMITS,
  translateValidationMessage,
  validateContributionAmount,
  validateScheduledContribution,
} from '../schemas/contributionSchema';

import type { ValidationMessage } from '../schemas/contributionSchema';

const NOW = new Date('2026-01-15T12:00:00Z');

/** Read a dotted key such as `contribution.validation.invalidAmount`. */
function lookup(dottedKey: string): unknown {
  return dottedKey
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === 'object'
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      en as unknown
    );
}

describe('contribution limits', () => {
  it('derives its defaults from the shared group validation constants', () => {
    expect(DEFAULT_CONTRIBUTION_LIMITS.min).toBe(VALIDATION_CONSTANTS.MIN_CONTRIBUTION_XLM);
    expect(DEFAULT_CONTRIBUTION_LIMITS.max).toBe(VALIDATION_CONSTANTS.MAX_CONTRIBUTION_XLM);
  });
});

describe('validateContributionAmount', () => {
  const limits = { min: 1, max: 100 };

  it('rejects an empty value', () => {
    expect(validateContributionAmount('', limits)?.defaultMessage).toBe(
      'Please enter a valid amount.'
    );
  });

  it('rejects a whitespace-only value', () => {
    expect(validateContributionAmount('   ', limits)?.defaultMessage).toBe(
      'Please enter a valid amount.'
    );
  });

  it('rejects a non-numeric value', () => {
    expect(validateContributionAmount('abc', limits)?.defaultMessage).toBe(
      'Please enter a valid amount.'
    );
  });

  it('rejects zero', () => {
    expect(validateContributionAmount('0', limits)?.defaultMessage).toBe(
      'Amount must be greater than 0.'
    );
  });

  it('rejects a negative amount', () => {
    expect(validateContributionAmount('-5', limits)?.defaultMessage).toBe(
      'Amount must be greater than 0.'
    );
  });

  it('rejects an amount below the minimum', () => {
    expect(validateContributionAmount('0.5', limits)?.defaultMessage).toBe(
      'Minimum contribution is {{min}} XLM.'
    );
  });

  it('rejects an amount above the maximum', () => {
    expect(validateContributionAmount('101', limits)?.defaultMessage).toBe(
      'Maximum contribution is {{max}} XLM.'
    );
  });

  it('accepts an amount on the lower bound', () => {
    expect(validateContributionAmount('1', limits)).toBeNull();
  });

  it('accepts an amount on the upper bound', () => {
    expect(validateContributionAmount('100', limits)).toBeNull();
  });

  it('accepts a value within the bounds', () => {
    expect(validateContributionAmount('42.5', limits)).toBeNull();
  });

  it('uses the shared default limits when none are supplied', () => {
    const atMin = String(DEFAULT_CONTRIBUTION_LIMITS.min);
    expect(validateContributionAmount(atMin)).toBeNull();
  });
});

describe('validateScheduledContribution', () => {
  it('rejects a missing amount', () => {
    const result = validateScheduledContribution(
      { amount: '', scheduledDate: '2099-12-31T10:00' },
      NOW
    );
    expect(result?.defaultMessage).toBe('Amount must be a positive number.');
  });

  it('rejects a non-positive amount', () => {
    const result = validateScheduledContribution(
      { amount: '0', scheduledDate: '2099-12-31T10:00' },
      NOW
    );
    expect(result?.defaultMessage).toBe('Amount must be a positive number.');
  });

  it('rejects a missing date', () => {
    const result = validateScheduledContribution({ amount: '10', scheduledDate: '' }, NOW);
    expect(result?.defaultMessage).toBe('Please select a date and time.');
  });

  it('rejects a date in the past', () => {
    const result = validateScheduledContribution(
      { amount: '10', scheduledDate: '2020-01-01T10:00' },
      NOW
    );
    expect(result?.defaultMessage).toBe('Scheduled date must be in the future.');
  });

  it('rejects a date equal to now', () => {
    const result = validateScheduledContribution(
      { amount: '10', scheduledDate: NOW.toISOString() },
      NOW
    );
    expect(result?.defaultMessage).toBe('Scheduled date must be in the future.');
  });

  it('accepts a future date with a positive amount', () => {
    expect(
      validateScheduledContribution({ amount: '10', scheduledDate: '2099-12-31T10:00' }, NOW)
    ).toBeNull();
  });

  it('reuses the pre-existing scheduler.validation i18n keys', () => {
    const result = validateScheduledContribution({ amount: '10', scheduledDate: '' }, NOW);
    expect(result?.key).toBe('scheduler.validation.selectDate');
  });
});

describe('i18n key wiring', () => {
  const failures: ValidationMessage[] = [
    ...['', 'abc', '0', '0.5', '101'].map(
      (v) => validateContributionAmount(v, { min: 1, max: 100 }) as ValidationMessage
    ),
    ...['', '0'].map(
      (amount) =>
        validateScheduledContribution({ amount, scheduledDate: '2099-12-31T10:00' }, NOW) as ValidationMessage
    ),
    validateScheduledContribution({ amount: '10', scheduledDate: '' }, NOW) as ValidationMessage,
    validateScheduledContribution({ amount: '10', scheduledDate: '2020-01-01T10:00' }, NOW) as ValidationMessage,
  ];

  it('every failure emits a non-empty key', () => {
    for (const failure of failures) {
      expect(failure.key).toBeTruthy();
    }
  });

  it('every key exists in the English locale', () => {
    for (const failure of failures) {
      expect(lookup(failure.key), `missing i18n key: ${failure.key}`).toBeTypeOf('string');
    }
  });

  it('the English locale agrees with each default message', () => {
    // Guards against a key and its default drifting apart.
    for (const failure of failures) {
      if (failure.values) continue; // interpolated messages embed placeholders
      expect(lookup(failure.key), `drifted message for ${failure.key}`).toBe(
        failure.defaultMessage
      );
    }
  });
});

describe('translateValidationMessage', () => {
  it('resolves a message with no interpolation values', () => {
    const result = validateContributionAmount('abc', { min: 1, max: 100 });
    expect(translateValidationMessage(result!)).toBe('Please enter a valid amount.');
  });

  it('interpolates the minimum bound', () => {
    const result = validateContributionAmount('0.5', { min: 2, max: 100 });
    expect(translateValidationMessage(result!)).toBe('Minimum contribution is 2 XLM.');
  });

  it('interpolates the maximum bound', () => {
    const result = validateContributionAmount('500', { min: 1, max: 250 });
    expect(translateValidationMessage(result!)).toBe('Maximum contribution is 250 XLM.');
  });

  it('produces English text whether or not i18n is initialised', () => {
    // The English locale mirrors every defaultMessage, so the i18next path and
    // the offline fallback must render identically.
    const result = validateScheduledContribution({ amount: '10', scheduledDate: '' }, NOW);
    expect(translateValidationMessage(result!)).toBe('Please select a date and time.');
  });
});
