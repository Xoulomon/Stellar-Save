/**
 * Shared formatting, validation, and date utilities for Stellar Save.
 *
 * Platform-agnostic — works in React (web), React Native (mobile), and Node.js.
 * Both the frontend (frontend/src) and mobile (mobile/src) import from here
 * instead of maintaining independent copies.
 */
/**
 * Format a raw numeric amount for display.
 *
 * @example
 * formatAmount(100.5)              // "100.5 XLM"
 * formatAmount(100, { symbol: 'USDC' }) // "100 USDC"
 * formatAmount('invalid')          // "0 XLM"
 */
export function formatAmount(amount, { decimals = 7, symbol = 'XLM', showSymbol = true } = {}) {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(num))
        return showSymbol ? `0 ${symbol}` : '0';
    const formatted = num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals,
    });
    return showSymbol ? `${formatted} ${symbol}` : formatted;
}
/**
 * Convert stroops (1e-7 XLM) to XLM and format for display.
 *
 * @example
 * formatStroops(10000000n) // "1 XLM"
 */
export function formatStroops(stroops, options = {}) {
    const xlm = Number(stroops) / 1e7;
    return formatAmount(xlm, { decimals: 2, ...options });
}
/**
 * Truncate a Stellar public key for compact display.
 *
 * @example
 * formatAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY5MGZTPVAJFO3T55V3L7RPLM3U6VJ6Q')
 * // "GAAZI4...J6Q"
 */
export function formatAddress(address, { prefixChars = 6, suffixChars = 4 } = {}) {
    if (!address || address.length <= prefixChars + suffixChars)
        return address;
    return `${address.slice(0, prefixChars)}...${address.slice(-suffixChars)}`;
}
// ── Address validation ────────────────────────────────────────────────────────
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
/** CRC16-XMODEM checksum used by Stellar StrKey encoding. */
function crc16(data) {
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
        crc ^= data[i] << 8;
        for (let j = 0; j < 8; j++) {
            crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
            crc &= 0xffff;
        }
    }
    return crc;
}
/** Decode a 56-char Stellar base32 address into its raw bytes. */
function base32Decode(input) {
    if (input.length !== 56 || !input.startsWith('G'))
        return null;
    let bits = '';
    for (let i = 0; i < input.length; i++) {
        const value = BASE32_ALPHABET.indexOf(input[i]);
        if (value === -1)
            return null;
        bits += value.toString(2).padStart(5, '0');
    }
    // 56 chars × 5 bits = 280 bits → 35 bytes (version + 32-byte key + 2-byte CRC)
    if (bits.length !== 280)
        return null;
    const bytes = new Uint8Array(35);
    for (let i = 0; i < 35; i++) {
        bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    }
    return bytes;
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
export function validateAddress(address) {
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
    // Version byte for a Stellar account (G-address) is 6 << 3 = 48
    if (bytes[0] !== 6 << 3) {
        return { valid: false, error: 'Invalid version byte' };
    }
    const expectedCrc = crc16(bytes.slice(0, 33));
    const actualCrc = (bytes[33] << 8) | bytes[34];
    if (expectedCrc !== actualCrc) {
        return { valid: false, error: 'Checksum mismatch' };
    }
    return { valid: true };
}
/** Convenience boolean wrapper around validateAddress. */
export function isValidStellarAddress(address) {
    return validateAddress(address).valid;
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
export function formatDate(input, { mode = 'relative', locale = 'en-US' } = {}) {
    const date = input instanceof Date ? input : new Date(input);
    if (isNaN(date.getTime()))
        throw new Error('Invalid date input');
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(Math.abs(diffMs) / 1000);
    // Future date within 1 week → compact countdown
    if (diffMs < 0 && diffSeconds < 7 * 24 * 60 * 60) {
        const days = Math.floor(diffSeconds / 86400);
        const hours = Math.floor((diffSeconds % 86400) / 3600);
        const minutes = Math.floor((diffSeconds % 3600) / 60);
        if (days > 0)
            return `${days}d ${hours}h`;
        if (hours > 0)
            return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (diffSeconds < 60)
        return rtf.format(-Math.floor(diffSeconds), 'second');
    if (diffSeconds < 3600)
        return rtf.format(-Math.floor(diffSeconds / 60), 'minute');
    if (diffSeconds < 86400)
        return rtf.format(-Math.floor(diffSeconds / 3600), 'hour');
    if (diffSeconds < 30 * 86400)
        return rtf.format(-Math.floor(diffSeconds / 86400), 'day');
    if (diffSeconds < 365 * 86400)
        return rtf.format(-Math.floor(diffSeconds / (30 * 86400)), 'month');
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}
/** Format a past date as "X minutes ago", "X hours ago", etc. */
export function formatDistanceToNow(date) {
    const past = date instanceof Date ? date : new Date(date);
    const diffSeconds = Math.floor((Date.now() - past.getTime()) / 1000);
    if (diffSeconds < 5)
        return 'just now';
    if (diffSeconds < 60)
        return `${diffSeconds} second${diffSeconds !== 1 ? 's' : ''} ago`;
    const mins = Math.floor(diffSeconds / 60);
    if (mins < 60)
        return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30)
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12)
        return `${months} month${months !== 1 ? 's' : ''} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years !== 1 ? 's' : ''} ago`;
}
