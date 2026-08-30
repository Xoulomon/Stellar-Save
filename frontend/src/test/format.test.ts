import { describe, it, expect } from 'vitest';

import { formatAmount, formatPercentage, formatDate, formatDateRange } from '../utils/format';

describe('formatAmount', () => {
  it('formats amount with USD currency by default', () => {
    const result = formatAmount(1000);
    expect(result).toContain('1,000');
    expect(result).toContain('$');
  });

  it('handles decimal amounts', () => {
    const result = formatAmount(1234.56);
    expect(result).toContain('1,234.56');
  });

  it('formats with custom fractionDigits', () => {
    const result = formatAmount(1000.123456, { fractionDigits: 4 });
    expect(result).toContain('1,000.1235');
  });

  it('handles zero amount', () => {
    const result = formatAmount(0);
    expect(result).toContain('0');
  });

  it('handles negative amounts', () => {
    const result = formatAmount(-1000);
    expect(result).toContain('-');
  });

  it('formats with different currency', () => {
    const result = formatAmount(1000, { currency: 'EUR' });
    expect(result).toContain('1,000');
  });
});

describe('formatPercentage', () => {
  it('formats percentage with default 1 decimal place', () => {
    const result = formatPercentage(50.555);
    expect(result).toBe('50.6%');
  });

  it('formats percentage with custom fraction digits', () => {
    const result = formatPercentage(50.555, 3);
    expect(result).toBe('50.555%');
  });

  it('handles zero', () => {
    expect(formatPercentage(0)).toBe('0.0%');
  });

  it('handles 100', () => {
    expect(formatPercentage(100)).toBe('100.0%');
  });
});

describe('formatDate', () => {
  it('formats date in medium format by default', () => {
    const date = new Date('2024-01-15');
    const result = formatDate(date);
    expect(result).toContain('2024');
    expect(result).toContain('15');
  });

  it('formats date in short format', () => {
    const date = new Date('2024-01-15');
    const result = formatDate(date, { format: 'short' });
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{2,4}/);
  });

  it('formats date in long format', () => {
    const date = new Date('2024-01-15');
    const result = formatDate(date, { format: 'long' });
    expect(result).toContain('January');
    expect(result).toContain('2024');
  });
});

describe('formatDateRange', () => {
  it('formats date range', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-02-01');
    const result = formatDateRange(start, end);
    expect(result).toContain(' - ');
    expect(result).toContain('2024');
  });

  it('formats date range with custom format', () => {
    const start = new Date('2024-01-01');
    const end = new Date('2024-02-01');
    const result = formatDateRange(start, end, { format: 'short' });
    expect(result).toContain(' - ');
  });
});
