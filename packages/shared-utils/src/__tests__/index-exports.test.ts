/**
 * index-exports.test.ts
 *
 * Verifies that all formatting symbols are reachable through the package's
 * public index so consumers that import from '@stellar-save/shared-utils'
 * (rather than the internal path) get the full surface.
 */
import { describe, it, expect } from 'vitest';
import {
  withRetry,
  formatAmount,
  formatDate,
  formatDateRelative,
  formatDateAbsolute,
  formatAddress,
} from '../index';

describe('@stellar-save/shared-utils public index', () => {
  it('exports withRetry as a function', () => {
    expect(typeof withRetry).toBe('function');
  });

  it('exports formatAmount as a function', () => {
    expect(typeof formatAmount).toBe('function');
  });

  it('exports formatDate as a function', () => {
    expect(typeof formatDate).toBe('function');
  });

  it('exports formatDateRelative as a function', () => {
    expect(typeof formatDateRelative).toBe('function');
  });

  it('exports formatDateAbsolute as a function', () => {
    expect(typeof formatDateAbsolute).toBe('function');
  });

  it('exports formatAddress as a function', () => {
    expect(typeof formatAddress).toBe('function');
  });

  // Smoke-test the formatting functions to confirm they behave consistently
  // when imported through the index (not just the internal path).
  it('formatAmount produces the expected string through the index', () => {
    expect(formatAmount(100)).toBe('100 XLM');
    expect(formatAmount(1234.5678, { decimals: 2 })).toBe('1,234.57 XLM');
    expect(formatAmount(50, { symbol: 'USDC' })).toBe('50 USDC');
    expect(formatAmount(NaN)).toBe('0 XLM');
  });

  it('formatAddress truncates correctly through the index', () => {
    const addr = 'GAAZI4TCR3TY5OJHCTJC2A4QSY5MGZTPVAJFO3T55V3L7RPLM3U6VJ6Q';
    expect(formatAddress(addr)).toBe('GAAZI4...VJ6Q');
  });

  it('formatDateAbsolute formats a known date through the index', () => {
    const result = formatDateAbsolute(new Date('2024-01-15T15:45:00Z'));
    expect(result).toMatch(/Jan 15, 2024/);
  });
});
