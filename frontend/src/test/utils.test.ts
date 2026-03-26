import { describe, it, expect, vi } from 'vitest';
import { errorHandler, formatErrorMessage } from '../utils/errorHandler';
import type { ParsedError } from '../utils/errorHandler';

// Keep existing util
function formatAmount(amount: number): string {
  return `${amount} XLM`;
}

describe('Utils', () => {
  describe('formatAmount', () => {
    it('formats amount correctly', () => {
      expect(formatAmount(100)).toBe('100 XLM');
      expect(formatAmount(0)).toBe('0 XLM');
    });
  });

  describe('errorHandler', () => {
    it('handles user rejection errors', () => {
      const result = errorHandler(new Error('User rejected the request'));
      expect(result.message).toBe('Transaction cancelled. This is safe.');
      expect(result.code).toBe('USER_REJECTED');
      expect(result.isUserAction).toBe(true);
    });

    it('handles insufficient funds', () => {
      const result = errorHandler(new Error('insufficient balance'));
      expect(result.message).toBe('Insufficient balance. Please add more XLM.');
      expect(result.code).toBe('INSUFFICIENT_FUNDS');
      expect(result.action).toBe('Fund wallet');
    });

    it('handles network errors', () => {
      const result = errorHandler(new Error('Network error: timeout'));
      expect(result.message).toBe('Network connection failed. Check your internet.');
      expect(result.isNetworkError).toBe(true);
      expect(result.action).toBe('Retry');
    });

    it('handles Stellar SDK codes', () => {
      const result = errorHandler({ code: 'not_found', message: 'Account not found' } as any);
      expect(result.message).toBe('Account or resource not found.');
      expect(result.code).toBe('not_found');
    });

    it('handles Freighter missing', () => {
      const result = errorHandler(new Error('Freighter not installed'));
      expect(result.message).toContain('Freighter');
      expect(result.code).toBe('FREIGHTER_MISSING');
    });

    it('handles generic errors', () => {
      const result = errorHandler(new Error('Random error'));
      expect(result.message).toBe('Random error');
    });

    it('handles non-Error unknowns', () => {
      const result = errorHandler('string error');
      expect(result.message).toContain('unexpected error');
    });

    it('handles null/undefined', () => {
      const result1 = errorHandler(null);
      const result2 = errorHandler(undefined);
      expect(result1.message).toContain('unexpected error');
      expect(result2.message).toContain('unexpected error');
    });
  });

  describe('formatErrorMessage', () => {
    it('returns formatted message', () => {
      const msg = formatErrorMessage(new Error('User rejected'));
      expect(msg).toBe('Transaction cancelled. This is safe.');
    });
  });

