/**
 * Re-exports from the shared @stellar-save/sdk package.
 * Existing imports of this module continue to work unchanged.
 */
export {
  formatDate,
  formatDistanceToNow,
} from '@stellar-save/sdk';
export type { FormatDateOptions } from '@stellar-save/sdk';

/** Convenience wrapper: always relative mode. */
export function formatDateRelative(
  input: string | number | Date,
  options: Omit<import('@stellar-save/sdk').FormatDateOptions, 'mode'> = {}
): string {
  const { formatDate: fd } = require('@stellar-save/sdk');
  return fd(input, { mode: 'relative', ...options });
}

/** Convenience wrapper: always absolute mode. */
export function formatDateAbsolute(
  input: string | number | Date,
  options: Omit<import('@stellar-save/sdk').FormatDateOptions, 'mode'> = {}
): string {
  const { formatDate: fd } = require('@stellar-save/sdk');
  return fd(input, { mode: 'absolute', ...options });
}
