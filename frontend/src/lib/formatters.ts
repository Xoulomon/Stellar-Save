/**
 * Single source of truth for display formatting (amounts, addresses, dates).
 * Prefer importing from here over defining local format helpers.
 */
export {
  formatAmount,
  formatStroops,
  formatDate,
  formatDistanceToNow,
  formatAddress,
} from '@stellar-save/sdk';
export type {
  FormatAmountOptions,
  FormatDateOptions,
  FormatAddressOptions,
} from '@stellar-save/sdk';

export const STROOPS_PER_XLM = 10_000_000;

/** Converts stroops to a human-readable XLM string (max 2 decimals), e.g. `1,234.5`. */
export function formatXlm(stroops: number | bigint): string {
  return (Number(stroops) / STROOPS_PER_XLM).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** Truncates a Stellar address to `GABCDE...WXYZ`. */
export function formatShortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Formats a date as `Jan 5, 2025`; returns `—` for missing values. */
export function formatShortDate(date: Date | null | undefined): string {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
