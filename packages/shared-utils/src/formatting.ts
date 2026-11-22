/**
 * formatting.ts — @shared-utils
 *
 * Single source of truth for amount, date, and address formatting.
 * Used by the frontend (and any future packages) so there is no divergence
 * between modules.
 *
 * All functions are pure and have no runtime dependencies beyond the native
 * Intl API, so they work in both browser and Node/Vitest environments.
 */

// ── Amount formatting ─────────────────────────────────────────────────────────

export interface FormatAmountOptions {
  /** Maximum decimal places. Defaults to 7 (Stellar's native precision). */
  decimals?: number;
  /** Token symbol to append. Defaults to "XLM". */
  symbol?: string;
  /** Whether to append the symbol. Defaults to true. */
  showSymbol?: boolean;
}

/**
 * Format a numeric XLM (or other token) amount for display.
 *
 * @example
 * formatAmount(1234.5678)              // "1,234.5678 XLM"
 * formatAmount(50, { symbol: 'USDC' }) // "50 USDC"
 * formatAmount(100, { showSymbol: false }) // "100"
 */
export function formatAmount(
  amount: number | string,
  { decimals = 7, symbol = 'XLM', showSymbol = true }: FormatAmountOptions = {},
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num)) return showSymbol ? `0 ${symbol}` : '0';

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });

  return showSymbol ? `${formatted} ${symbol}` : formatted;
}

// ── Date formatting ───────────────────────────────────────────────────────────

export interface FormatDateOptions {
  /** Display mode. Defaults to "relative". */
  mode?: 'relative' | 'absolute';
  /** Locale string. Defaults to "en-US". */
  locale?: string;
  /**
   * Ceiling unit for relative formatting.
   * Defaults to "year" (no ceiling).
   */
  maxRelativeUnit?: 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';
}

/**
 * Format a date as a relative string ("2 hours ago") or an absolute string
 * ("Jan 15, 2024 3:45 PM").
 *
 * @throws {Error} If `input` cannot be parsed as a valid date.
 */
export function formatDate(
  input: string | number | Date,
  options: FormatDateOptions = {},
): string {
  const { mode = 'relative', locale = 'en-US', maxRelativeUnit = 'year' } = options;

  const date: Date =
    input instanceof Date ? input : new Date(input as string | number);

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date input');
  }

  const now = new Date();
  const diffMs = Math.abs(now.getTime() - date.getTime());
  const diffSeconds = Math.floor(diffMs / 1000);

  if (mode === 'absolute') {
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    });
  }

  // Future date within 1 week → compact remaining style ("2d 3h")
  if (date > now && diffSeconds < 7 * 24 * 60 * 60) {
    const days = Math.floor(diffSeconds / (24 * 60 * 60));
    const hours = Math.floor((diffSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((diffSeconds % (60 * 60)) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  // Past relative
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffSeconds < 60 && maxRelativeUnit === 'second') {
    return rtf.format(-Math.floor(diffMs / 1000), 'second');
  }
  if (diffSeconds < 60 * 60 && maxRelativeUnit === 'minute') {
    return rtf.format(-Math.floor(diffSeconds / 60), 'minute');
  }
  if (diffSeconds < 24 * 60 * 60 && maxRelativeUnit === 'hour') {
    return rtf.format(-Math.floor(diffSeconds / (60 * 60)), 'hour');
  }
  if (diffSeconds < 30 * 24 * 60 * 60 && maxRelativeUnit === 'day') {
    return rtf.format(-Math.floor(diffSeconds / (24 * 60 * 60)), 'day');
  }
  if (diffSeconds < 12 * 30 * 24 * 60 * 60 && maxRelativeUnit === 'month') {
    return rtf.format(-Math.floor(diffSeconds / (30 * 24 * 60 * 60)), 'month');
  }

  // Fallback to short absolute date
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

/** Convenience wrapper: always uses relative mode. */
export function formatDateRelative(
  input: string | number | Date,
  options: Omit<FormatDateOptions, 'mode'> = {},
): string {
  return formatDate(input, { mode: 'relative', ...options });
}

/** Convenience wrapper: always uses absolute mode. */
export function formatDateAbsolute(
  input: string | number | Date,
  options: Omit<FormatDateOptions, 'mode'> = {},
): string {
  return formatDate(input, { mode: 'absolute', ...options });
}

// ── Address formatting ────────────────────────────────────────────────────────

export interface FormatAddressOptions {
  /** Characters to keep at the start. Defaults to 6. */
  prefixChars?: number;
  /** Characters to keep at the end. Defaults to 4. */
  suffixChars?: number;
}

/**
 * Truncate a Stellar address for display: "GABCD...WXYZ".
 *
 * @example
 * formatAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN')
 * // "GAAZI4...CCWN"
 */
export function formatAddress(
  address: string,
  { prefixChars = 6, suffixChars = 4 }: FormatAddressOptions = {},
): string {
  if (!address || address.length <= prefixChars + suffixChars) return address;
  return `${address.slice(0, prefixChars)}...${address.slice(-suffixChars)}`;
}
