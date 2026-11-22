/**
 * Single frontend entry point for display formatting (amounts, dates, addresses).
 * Implementations live in @shared-utils/formatting and lib/formatters.
 * Import from here instead of writing local format helpers.
 */
export {
  formatAmount,
  formatDate,
  formatDateRelative,
  formatDateAbsolute,
  formatAddress,
  type FormatAmountOptions,
  type FormatDateOptions,
  type FormatAddressOptions,
} from '@shared-utils/formatting';
export { formatXlm, formatShortAddress, formatShortDate } from '../lib/formatters';

type DateInput = string | number | Date;

function toValidDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) throw new Error('Invalid date input');
  return date;
}

/** Formats a number as a percentage, e.g. `formatPercentage(50.555)` -> `50.6%`. */
export function formatPercentage(value: number, fractionDigits = 1): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `${safe.toFixed(fractionDigits)}%`;
}

/** Formats a date range, e.g. `Jan 1, 2024 - Feb 1, 2024`. Throws on invalid dates. */
export function formatDateRange(start: DateInput, end: DateInput): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${fmt(toValidDate(start))} - ${fmt(toValidDate(end))}`;
}
