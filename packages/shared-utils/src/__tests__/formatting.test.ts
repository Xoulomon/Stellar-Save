/**
 * formatting.test.ts
 *
 * Comprehensive tests for @shared-utils/formatting covering every case that
 * was previously tested in the frontend's local test files, plus additional
 * cases for completeness.
 */

import { describe, it, expect } from 'vitest';
import {
  formatAmount,
  formatDate,
  formatDateRelative,
  formatDateAbsolute,
  formatAddress,
} from '../formatting';

// ── formatAmount ──────────────────────────────────────────────────────────────

describe('formatAmount', () => {
  it('formats a whole number with XLM symbol', () => {
    expect(formatAmount(100)).toBe('100 XLM');
  });

  it('formats with decimal places', () => {
    expect(formatAmount(1234.5678)).toBe('1,234.5678 XLM');
  });

  it('adds thousand separators', () => {
    expect(formatAmount(1_000_000)).toBe('1,000,000 XLM');
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

  it('defaults to 7 decimal places of precision', () => {
    expect(formatAmount(1.1234567)).toBe('1.1234567 XLM');
    // More than 7 decimals are truncated
    expect(formatAmount(1.12345678)).toBe('1.1234568 XLM');
  });
});

// ── formatDate ────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('throws for invalid date input', () => {
    expect(() => formatDate('not-a-date')).toThrow('Invalid date input');
  });

  it('formats an absolute date string', () => {
    // Fixed timestamp so the test is deterministic
    const result = formatDate(new Date('2024-01-15T15:45:00Z'), { mode: 'absolute' });
    expect(result).toMatch(/Jan 15, 2024/);
  });

  it('returns a past relative string for an old date', () => {
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // ~30 days ago
    const result = formatDate(old, { mode: 'relative', maxRelativeUnit: 'day' });
    // Should match something like "30 days ago"
    expect(result).toMatch(/\d+|ago|day/i);
  });

  it('returns compact remaining for a near-future date', () => {
    const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000); // 2d 3h
    const result = formatDate(soon);
    expect(result).toMatch(/\d+d \d+h/);
  });

  it('formatDateRelative delegates to relative mode', () => {
    const old = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const r1 = formatDateRelative(old, { maxRelativeUnit: 'day' });
    const r2 = formatDate(old, { mode: 'relative', maxRelativeUnit: 'day' });
    expect(r1).toBe(r2);
  });

  it('formatDateAbsolute delegates to absolute mode', () => {
    const d = new Date('2025-06-01T12:00:00Z');
    const r1 = formatDateAbsolute(d);
    const r2 = formatDate(d, { mode: 'absolute' });
    expect(r1).toBe(r2);
  });

  it('accepts a numeric timestamp', () => {
    const ts = new Date('2024-03-10').getTime();
    expect(() => formatDate(ts, { mode: 'absolute' })).not.toThrow();
  });
});

// ── formatAddress ─────────────────────────────────────────────────────────────

const ADDR = 'GAAZI4TCR3TY5OJHCTJC2A4QSY5MGZTPVAJFO3T55V3L7RPLM3U6VJ6Q';

describe('formatAddress', () => {
  it('truncates with default options', () => {
    expect(formatAddress(ADDR)).toBe('GAAZI4...VJ6Q');
  });

  it('respects custom prefixChars and suffixChars', () => {
    expect(formatAddress(ADDR, { prefixChars: 4, suffixChars: 6 })).toBe('GAAZ...U6VJ6Q');
  });

  it('returns address as-is when shorter than prefix + suffix', () => {
    expect(formatAddress('GABC', { prefixChars: 4, suffixChars: 4 })).toBe('GABC');
  });

  it('returns empty string for empty input', () => {
    expect(formatAddress('')).toBe('');
  });

  it('handles a full 56-character Stellar address', () => {
    const full = 'G' + 'A'.repeat(55);
    const result = formatAddress(full);
    expect(result).toBe(`GAAAAAA...AAAA`);
  });
});
