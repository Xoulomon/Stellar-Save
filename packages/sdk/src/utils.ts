/**
 * SDK utilities — Stellar-Save.
 *
 * Generic display formatting (formatAmount, formatDate, formatAddress) has
 * moved to @stellar-save/shared-utils/formatting, which is the single source
 * of truth used by this package, the frontend, and the backend.
 *
 * Re-exporting from here preserves full backwards compatibility for existing
 * SDK consumers — no import paths need to change.
 *
 * Only Stellar-specific helpers (CRC16 address validation, stroops conversion)
 * remain implemented in this file.
 */

// ── Re-exports from shared-utils (single source of truth) ────────────────────

export {
  formatAmount,
  type FormatAmountOptions,
  formatDate,
  type FormatDateOptions,
  formatAddress,
  type FormatAddressOptions,
} from '@stellar-save/shared-utils';

// ── Stellar-specific: stroops conversion ──────────────────────────────────────

import { formatAmount } from '@stellar-save/shared-utils';

/**
 * Convert stroops (1e-7 XLM) to XLM and format for display.
 *
 * @example
 * formatStroops(10000000n) // "1 XLM"
 */
export function formatStroops(
  stroops: bigint | number,
  options: import('@stellar-save/shared-utils').FormatAmountOptions = {},
): string {
  const xlm = Number(stroops) / 1e7;
  return formatAmount(xlm, { decimals: 2, ...options });
}

// ── Stellar-specific: address validation (CRC16-XMODEM + StrKey) ─────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** CRC16-XMODEM checksum used by Stellar StrKey encoding. */
function crc16(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i] ?? 0;
    crc ^= byte << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

/** Decode a 56-char Stellar base32 address into its raw bytes. */
function base32Decode(input: string): Uint8Array | null {
  if (input.length !== 56 || !input.startsWith('G')) return null;

  let bits = '';
  for (let i = 0; i < input.length; i++) {
    const char = input[i] ?? '';
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) return null;
    bits += value.toString(2).padStart(5, '0');
  }

  if (bits.length !== 280) return null;

  const bytes = new Uint8Array(35);
  for (let i = 0; i < 35; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}

export interface ValidateAddressResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a Stellar public key (format + CRC16-XMODEM checksum).
 *
 * @example
 * validateAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY5MGZTPVAJFO3T55V3L7RPLM3U6VJ6Q')
 * // { valid: true }
 * validateAddress('not-a-key')
 * // { valid: false, error: 'Must be 56 chars starting with G' }
 */
export function validateAddress(address: string): ValidateAddressResult {
  if (typeof address !== 'string') {
    return { valid: false, error: 'Address must be a string' };
  }
  const trimmed = address.trim();
  if (trimmed.length !== 56 || !trimmed.startsWith('G')) {
    return { valid: false, error: 'Must be 56 chars starting with G' };
  }

  const bytes = base32Decode(trimmed);
  if (!bytes) {
    return { valid: false, error: 'Invalid base32 characters' };
  }

  if (bytes[0] !== 6 << 3) {
    return { valid: false, error: 'Invalid version byte' };
  }

  const expectedCrc = crc16(bytes.slice(0, 33));
  const actualCrc = ((bytes[33] ?? 0) << 8) | (bytes[34] ?? 0);
  if (expectedCrc !== actualCrc) {
    return { valid: false, error: 'Checksum mismatch' };
  }

  return { valid: true };
}

/** Convenience boolean wrapper around validateAddress. */
export function isValidStellarAddress(address: string): boolean {
  return validateAddress(address).valid;
}

// ── Shared formatDistanceToNow (kept for SDK backwards compat) ────────────────

/**
 * Format a past date as "X minutes ago", "X hours ago", etc.
 *
 * @deprecated Prefer `formatDate` from @stellar-save/shared-utils for new
 * code. This helper remains for SDK consumers that call it directly.
 */
export function formatDistanceToNow(date: Date | number | string): string {
  const past = date instanceof Date ? date : new Date(date);
  const diffSeconds = Math.floor((Date.now() - past.getTime()) / 1000);

  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`;

  const mins = Math.floor(diffSeconds / 60);
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
}
