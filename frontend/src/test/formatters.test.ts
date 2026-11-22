import { describe, expect, it } from 'vitest';

import { formatShortAddress, formatShortDate, formatXlm, STROOPS_PER_XLM } from '../lib/formatters';

describe('lib/formatters', () => {
  describe('formatXlm', () => {
    it('converts stroops to XLM', () => {
      expect(formatXlm(STROOPS_PER_XLM)).toBe('1');
      expect(formatXlm(12_345_000_000)).toBe('1,234.5');
    });

    it('accepts bigint and rounds to 2 decimals', () => {
      expect(formatXlm(12_345_678n)).toBe('1.23');
    });
  });

  describe('formatShortAddress', () => {
    it('truncates to first 6 and last 4 chars', () => {
      expect(formatShortAddress('GABCDEFGHIJKLMNOPWXYZ')).toBe('GABCDE...WXYZ');
    });
  });

  describe('formatShortDate', () => {
    it('formats as short month, day, year', () => {
      expect(formatShortDate(new Date(2025, 0, 5))).toBe('Jan 5, 2025');
    });

    it('returns an em dash for missing dates', () => {
      expect(formatShortDate(null)).toBe('—');
      expect(formatShortDate(undefined)).toBe('—');
    });
  });
});
