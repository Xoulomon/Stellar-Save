/**
 * Regression tests for PR #1451: `normalizeQuery` was missing the `.trim()`
 * step, so a query with leading/trailing whitespace failed to match
 * suggestions even when the user had typed valid content — a silent
 * failure that cleared the dropdown unexpectedly.
 *
 * Related: #16, #17 (issue #1548). Split out of the former
 * SearchBarSharedFiltering.regression.test.tsx — see #1917.
 */
import { describe, it, expect } from 'vitest';

import { normalizeQuery } from '../utils/searchUtils';

describe('normalizeQuery — consistent trim + lowercase (PR #1451)', () => {
  it('trims leading whitespace', () => {
    expect(normalizeQuery('   alpha')).toBe('alpha');
  });

  it('trims trailing whitespace', () => {
    expect(normalizeQuery('alpha   ')).toBe('alpha');
  });

  it('trims both sides', () => {
    expect(normalizeQuery('  alpha  ')).toBe('alpha');
  });

  it('converts to lowercase', () => {
    expect(normalizeQuery('ALPHA')).toBe('alpha');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(normalizeQuery('   ')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeQuery('')).toBe('');
  });
});
