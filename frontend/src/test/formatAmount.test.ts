import { describe, it, expect } from 'vitest';
import { formatAmount } from '../utils/formatAmount';

describe('formatAmount', () => {
  it('formats a whole number with XLM symbol', () => {
    expect(formatAmount(100)).toBe('100 XLM');
  });

  it('formats with decimal places', () => {
    expect(formatAmount(1234.5678)).toBe('1,234.5678 XLM');
  });

  it('adds thousand separators', () => {
    expect(formatAmount(1000000)).toBe('1,000,000 XLM');
  });

  it('respects custom decimals', () => {
    expect(formatAmount(1.23456789, { decimals: 2 })).toBe('1.23 XLM');
  });

  it('uses custom symbol', () => {
    expect(formatAmount(50, { symbol: 'USDC' })).toBe('50 USDC');
  });

  it('hides symbol when showSymbol is false', () => {
    expect(formatAmount(100, { showSymbol: false })).toBe('100');
  });

  it('handles string input', () => {
    expect(formatAmount('250.5')).toBe('250.5 XLM');
  });

  it('handles zero', () => {
    expect(formatAmount(0)).toBe('0 XLM');
  });

  it('handles NaN input', () => {
    expect(formatAmount(NaN)).toBe('0 XLM');
    expect(formatAmount('not-a-number')).toBe('0 XLM');
  });

  it('handles negative amounts', () => {
    expect(formatAmount(-100)).toBe('-100 XLM');
  });
});
