/**
 * Shared formatting, validation, and date utilities for Stellar Save.
 *
 * Platform-agnostic — works in React (web), React Native (mobile), and Node.js.
 * Both the frontend (frontend/src) and mobile (mobile/src) import from here
 * instead of maintaining independent copies.
 */
export interface FormatAmountOptions {
    /** Decimal places to display (default: 7) */
    decimals?: number;
    /** Currency symbol to append (default: 'XLM') */
    symbol?: string;
    /** Whether to append the symbol (default: true) */
    showSymbol?: boolean;
}
/**
 * Format a raw numeric amount for display.
 *
 * @example
 * formatAmount(100.5)              // "100.5 XLM"
 * formatAmount(100, { symbol: 'USDC' }) // "100 USDC"
 * formatAmount('invalid')          // "0 XLM"
 */
export declare function formatAmount(amount: number | string, { decimals, symbol, showSymbol }?: FormatAmountOptions): string;
/**
 * Convert stroops (1e-7 XLM) to XLM and format for display.
 *
 * @example
 * formatStroops(10000000n) // "1 XLM"
 */
export declare function formatStroops(stroops: bigint | number, options?: FormatAmountOptions): string;
export interface FormatAddressOptions {
    /** Characters to show at the start (default: 6) */
    prefixChars?: number;
    /** Characters to show at the end (default: 4) */
    suffixChars?: number;
}
/**
 * Truncate a Stellar public key for compact display.
 *
 * @example
 * formatAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY5MGZTPVAJFO3T55V3L7RPLM3U6VJ6Q')
 * // "GAAZI4...J6Q"
 */
export declare function formatAddress(address: string, { prefixChars, suffixChars }?: FormatAddressOptions): string;
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
export declare function validateAddress(address: string): ValidateAddressResult;
/** Convenience boolean wrapper around validateAddress. */
export declare function isValidStellarAddress(address: string): boolean;
export interface FormatDateOptions {
    /** 'relative' (default) or 'absolute' */
    mode?: 'relative' | 'absolute';
    /** Locale for formatting (default: 'en-US') */
    locale?: string;
}
/**
 * Format a timestamp as a human-readable relative or absolute date.
 *
 * @example
 * formatDate(Date.now() - 60_000)          // "1 minute ago"
 * formatDate(someDate, { mode: 'absolute' }) // "Jan 15, 2024, 3:45 PM"
 *
 * @throws {Error} if the input cannot be parsed as a valid date
 */
export declare function formatDate(input: string | number | Date, { mode, locale }?: FormatDateOptions): string;
/** Format a past date as "X minutes ago", "X hours ago", etc. */
export declare function formatDistanceToNow(date: Date | number | string): string;
//# sourceMappingURL=utils.d.ts.map