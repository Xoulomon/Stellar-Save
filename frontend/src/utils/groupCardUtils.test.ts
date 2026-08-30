import { describe, it, expect } from 'vitest';

import { formatXlm, computeNextPayout, formatDate } from './groupCardUtils';

describe('formatXlm', () => {
  it('converts stroops to XLM', () => {
    expect(formatXlm(10_000_000)).toBe('1');
  });

  it('formats fractional XLM with up to 2 decimal places', () => {
    expect(formatXlm(1_234_567)).toBe('0.12');
  });

  it('formats zero', () => {
    expect(formatXlm(0)).toBe('0');
  });
});

describe('computeNextPayout', () => {
  it('returns null when startedAt is null', () => {
    expect(computeNextPayout(null, 0, 86400)).toBeNull();
  });

  it('returns null when cycleDurationSecs is not positive', () => {
    expect(computeNextPayout(new Date('2026-01-01'), 0, 0)).toBeNull();
  });

  it('computes the next payout date from cycle duration', () => {
    const started = new Date('2026-01-01T00:00:00Z');
    const result = computeNextPayout(started, 0, 86400);
    expect(result).toEqual(new Date('2026-01-02T00:00:00Z'));
  });

  it('accounts for the current cycle offset', () => {
    const started = new Date('2026-01-01T00:00:00Z');
    const result = computeNextPayout(started, 2, 86400);
    expect(result).toEqual(new Date('2026-01-04T00:00:00Z'));
  });
});

describe('formatDate', () => {
  it('returns an em dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns an em dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('formats a date as "Mon D, YYYY"', () => {
    expect(formatDate(new Date('2026-08-01'))).toBe('Aug 1, 2026');
  });
});
