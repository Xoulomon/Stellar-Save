import { describe, it, expect } from 'vitest';

import {
  formatAmount,
  formatDate,
  formatDateAbsolute,
  formatAddress,
  formatPercentage,
  formatDateRange,
  formatXlm,
  formatShortAddress,
  formatShortDate,
} from '../utils/format';

const ADDR = 'GAAZI4TCR3TY5OJHCTJC2A4QSY5MGZTPVAJFO3T55V3L7RPLM3U6VJ6Q';

describe('formatAmount', () => {
  it('appends XLM by default', () => {
    expect(formatAmount(1234.5678)).toBe('1,234.5678 XLM');
  });
  it('supports custom symbol and hiding it', () => {
    expect(formatAmount(50, { symbol: 'USDC' })).toBe('50 USDC');
    expect(formatAmount(100, { showSymbol: false })).toBe('100');
  });
  it('limits decimals', () => {
    expect(formatAmount(1.23456789, { decimals: 2 })).toBe('1.23 XLM');
  });
  it('returns zero for non-numeric input', () => {
    expect(formatAmount('abc')).toBe('0 XLM');
    expect(formatAmount('abc', { showSymbol: false })).toBe('0');
  });
});

describe('formatAddress', () => {
  it('truncates long addresses', () => {
    expect(formatAddress(ADDR)).toBe(`${ADDR.slice(0, 6)}...${ADDR.slice(-4)}`);
  });
  it('honors custom lengths', () => {
    expect(formatAddress(ADDR, { prefixChars: 8, suffixChars: 6 })).toBe(
      `${ADDR.slice(0, 8)}...${ADDR.slice(-6)}`
    );
  });
  it('returns short or empty input unchanged', () => {
    expect(formatAddress('GABC')).toBe('GABC');
    expect(formatAddress('')).toBe('');
  });
});

describe('formatDate', () => {
  it('formats absolute dates', () => {
    const out = formatDateAbsolute(new Date(2024, 0, 15, 12, 0));
    expect(out).toContain('Jan');
    expect(out).toContain('2024');
  });
  it('throws on invalid input', () => {
    expect(() => formatDate('not a date')).toThrow('Invalid date input');
  });
});

describe('formatPercentage', () => {
  it('uses one decimal by default', () => {
    expect(formatPercentage(50.555)).toBe('50.6%');
    expect(formatPercentage(0)).toBe('0.0%');
    expect(formatPercentage(100)).toBe('100.0%');
  });
  it('supports custom fraction digits', () => {
    expect(formatPercentage(50.555, 3)).toBe('50.555%');
  });
  it('treats NaN and Infinity as zero', () => {
    expect(formatPercentage(NaN)).toBe('0.0%');
    expect(formatPercentage(Infinity)).toBe('0.0%');
  });
});

describe('formatDateRange', () => {
  it('formats a range', () => {
    expect(formatDateRange(new Date(2024, 0, 1), new Date(2024, 1, 1))).toBe(
      'Jan 1, 2024 - Feb 1, 2024'
    );
  });
  it('throws on invalid dates', () => {
    expect(() => formatDateRange('bad', new Date())).toThrow('Invalid date input');
    expect(() => formatDateRange(new Date(), 'bad')).toThrow('Invalid date input');
  });
});

describe('re-exported lib/formatters helpers', () => {
  it('converts stroops to XLM', () => {
    expect(formatXlm(10_000_000)).toBe('1');
    expect(formatXlm(15_000_000)).toBe('1.5');
  });
  it('shortens addresses', () => {
    expect(formatShortAddress(ADDR)).toBe(`${ADDR.slice(0, 6)}...${ADDR.slice(-4)}`);
  });
  it('formats short dates and handles missing ones', () => {
    expect(formatShortDate(new Date(2025, 0, 5))).toBe('Jan 5, 2025');
    expect(formatShortDate(null)).toBe('—');
  });
});
