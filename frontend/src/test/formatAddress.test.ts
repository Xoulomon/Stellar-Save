import { describe, it, expect } from 'vitest';
import { formatAddress } from '../utils/formatAddress';

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
});
