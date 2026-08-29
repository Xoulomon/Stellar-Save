/**
 * Shared validation helpers used by both frontend and backend.
 *
 * These provide consistent validation logic regardless of which
 * validation library (Zod, Yup, etc.) the consumer uses.
 */

/** Stellar public key regex: 56-character G... address. */
export const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/;

/**
 * Validate a Stellar public key.
 */
export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address);
}

/**
 * Validate an email address (RFC 5322 simplified).
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Clamp a pagination limit to [1, max].
 */
export function clampLimit(value: number, max = 100): number {
  return Math.max(1, Math.min(Math.floor(value), max));
}

/**
 * Clamp a pagination offset to [0, ∞).
 */
export function clampOffset(value: number): number {
  return Math.max(0, Math.floor(value));
}

/**
 * Check whether a string is a valid positive number.
 */
export function isPositiveNumber(value: string): boolean {
  const num = Number(value);
  return !isNaN(num) && num > 0 && isFinite(num);
}
