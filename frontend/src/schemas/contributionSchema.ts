/**
 * contributionSchema.ts
 *
 * Shared validation for the contribution forms.
 *
 * `ContributionFlow` and `ContributionScheduler` both validate a contribution
 * amount but previously carried independent, hand-rolled copies of the same
 * rules. Both now resolve their limits from `groupSchema`'s
 * `VALIDATION_CONSTANTS` so a limit is defined in exactly one place.
 *
 * ## Why messages are keys, not strings
 *
 * A schema is a plain module and has no access to the React i18n context, so
 * validators return a {@link ValidationMessage} — an i18n key plus the English
 * default and any interpolation values. Callers render it through
 * {@link translateValidationMessage}, which uses i18next when it is
 * initialised and falls back to the English default when it is not (unit
 * tests, and any consumer that renders before `src/i18n` has run).
 */
import i18n from 'i18next';

import { VALIDATION_CONSTANTS } from './groupSchema';

const { MIN_CONTRIBUTION_XLM, MAX_CONTRIBUTION_XLM } = VALIDATION_CONSTANTS;

/** A validation failure, expressed so it can be translated at render time. */
export interface ValidationMessage {
  /** i18n key, resolved against the `translation` namespace. */
  key: string;
  /** English text used when i18n is unavailable. */
  defaultMessage: string;
  /** Interpolation values for `{{placeholders}}`. */
  values?: Record<string, string | number>;
}

/** Replace `{{name}}` placeholders. Mirrors i18next interpolation. */
function interpolate(template: string, values?: Record<string, string | number>): string {
  if (!values) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  );
}

/**
 * Resolve a {@link ValidationMessage} to display text.
 *
 * Prefers the active locale; falls back to the English default so validation
 * still reads correctly when i18next has not been initialised.
 */
export function translateValidationMessage(message: ValidationMessage): string {
  if (i18n.isInitialized) {
    return i18n.t(message.key, {
      defaultValue: message.defaultMessage,
      ...message.values,
    }) as string;
  }
  return interpolate(message.defaultMessage, message.values);
}

/** Inclusive contribution bounds, in XLM. */
export interface ContributionLimits {
  min: number;
  max: number;
}

/** Default bounds, taken from the shared group validation constants. */
export const DEFAULT_CONTRIBUTION_LIMITS: ContributionLimits = {
  min: MIN_CONTRIBUTION_XLM,
  max: MAX_CONTRIBUTION_XLM,
};

/**
 * Validate a raw contribution amount.
 *
 * Order matters and is preserved from the previous inline implementations:
 * emptiness, then sign, then bounds.
 *
 * @param raw     Raw text from the amount field.
 * @param limits  Inclusive min/max in XLM. Defaults to {@link DEFAULT_CONTRIBUTION_LIMITS}.
 * @returns The failure, or `null` when the amount is valid.
 */
export function validateContributionAmount(
  raw: string,
  limits: ContributionLimits = DEFAULT_CONTRIBUTION_LIMITS
): ValidationMessage | null {
  const value = parseFloat(raw);

  if (!raw.trim() || isNaN(value)) {
    return {
      key: 'contribution.validation.invalidAmount',
      defaultMessage: 'Please enter a valid amount.',
    };
  }

  if (value <= 0) {
    return {
      key: 'contribution.validation.positiveAmount',
      defaultMessage: 'Amount must be greater than 0.',
    };
  }

  if (value < limits.min) {
    return {
      key: 'contribution.validation.minAmount',
      defaultMessage: 'Minimum contribution is {{min}} XLM.',
      values: { min: limits.min },
    };
  }

  if (value > limits.max) {
    return {
      key: 'contribution.validation.maxAmount',
      defaultMessage: 'Maximum contribution is {{max}} XLM.',
      values: { max: limits.max },
    };
  }

  return null;
}

/** Raw fields of the "schedule a contribution" form. */
export interface ScheduledContributionInput {
  amount: string;
  scheduledDate: string;
}

/**
 * Validate a scheduled contribution.
 *
 * Replaces the duplicated `validate()` in `ContributionScheduler`; the message
 * keys already existed under `scheduler.validation.*` in every locale.
 *
 * @param form  Raw form values.
 * @param now   Injectable clock, so the "must be in the future" rule is testable.
 * @returns The failure, or `null` when the entry is valid.
 */
export function validateScheduledContribution(
  form: ScheduledContributionInput,
  now: Date = new Date()
): ValidationMessage | null {
  const amount = parseFloat(form.amount);

  if (!form.amount || isNaN(amount) || amount <= 0) {
    return {
      key: 'scheduler.validation.positiveAmount',
      defaultMessage: 'Amount must be a positive number.',
    };
  }

  if (!form.scheduledDate) {
    return {
      key: 'scheduler.validation.selectDate',
      defaultMessage: 'Please select a date and time.',
    };
  }

  if (new Date(form.scheduledDate) <= now) {
    return {
      key: 'scheduler.validation.futureDate',
      defaultMessage: 'Scheduled date must be in the future.',
    };
  }

  return null;
}
