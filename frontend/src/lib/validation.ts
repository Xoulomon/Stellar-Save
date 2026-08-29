import { z } from 'zod';

/**
 * Shared validation patterns & regexes
 */
export const STELLAR_ADDRESS_REGEX = /^G[A-Z0-9]{55}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;

/**
 * Shared validator functions for common field inputs
 */

/**
 * Validates a Stellar public key (G... 56 chars)
 */
export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address.trim());
}

/**
 * Validates email formatting
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Validates web URL formatting
 */
export function isValidUrl(url: string): boolean {
  if (!url) return true;
  return URL_REGEX.test(url.trim());
}

/**
 * Validates positive number values
 */
export function isValidPositiveNumber(val: string | number): boolean {
  const num = typeof val === 'number' ? val : parseFloat(val);
  return !isNaN(num) && num > 0;
}

/**
 * Validates numeric ranges
 */
export function isValidNumberInRange(val: string | number, min: number, max: number): boolean {
  const num = typeof val === 'number' ? val : parseFloat(val);
  return !isNaN(num) && num >= min && num <= max;
}

/**
 * Validates string length constraints
 */
export function isValidStringLength(str: string, min: number, max: number): boolean {
  const len = str.trim().length;
  return len >= min && len <= max;
}

/**
 * Reusable Zod schemas for shared forms & fields across the frontend
 */
export const commonValidators = {
  stellarAddress: z
    .string()
    .trim()
    .refine(isValidStellarAddress, 'Invalid Stellar public key (must start with G and be 56 characters)'),

  email: z
    .string()
    .trim()
    .email('Invalid email address format'),

  url: z
    .string()
    .url('Must be a valid URL')
    .optional()
    .or(z.literal('')),

  positiveNumberString: (minVal = 0, fieldName = 'Amount') =>
    z
      .string()
      .refine(
        (val) => {
          const num = parseFloat(val);
          return !isNaN(num) && num > minVal;
        },
        `${fieldName} must be greater than ${minVal}`,
      ),

  boundedNumberString: (minVal: number, maxVal: number, fieldName = 'Value') =>
    z
      .string()
      .refine(
        (val) => isValidNumberInRange(val, minVal, maxVal),
        `${fieldName} must be between ${minVal} and ${maxVal}`,
      ),

  nonEmptyString: (maxLen: number, fieldName = 'Field') =>
    z
      .string()
      .trim()
      .min(1, `${fieldName} is required`)
      .max(maxLen, `${fieldName} must be at most ${maxLen} characters`),
};
