/**
 * Regression tests for PR #1450: `applyGroupFilters` leaked state across
 * calls when the same params object was mutated externally between them.
 * The fix treats params as value objects, so each call operates on its own
 * snapshot — these tests guard specifically that cross-call behavior.
 *
 * General filter-matching behavior (search/currency/amount matching,
 * combined filters, case-insensitivity, non-numeric bounds) is already
 * covered by filters.test.ts and is not duplicated here.
 *
 * Related: #16, #17 (issue #1548). Split out of the former
 * SearchBarSharedFiltering.regression.test.tsx — see #1917.
 */
import { describe, it, expect } from 'vitest';

import { applyGroupFilters } from '../lib/filters';

describe('applyGroupFilters — calls are independent (PR #1450)', () => {
  const groups = [
    { id: '1', name: 'Alpha Savers', currency: 'XLM', contributionAmount: 100 },
    { id: '2', name: 'Beta Circle', currency: 'USDC', contributionAmount: 250 },
    { id: '3', name: 'Gamma Fund', currency: 'XLM', contributionAmount: 500 },
  ];

  it('searchQuery filter is isolated to its own call', () => {
    const params1 = { searchQuery: 'Alpha' };
    const params2 = { searchQuery: 'Gamma' };

    const result1 = applyGroupFilters(groups, params1);
    const result2 = applyGroupFilters(groups, params2);

    expect(result1.map((g) => g.name)).toEqual(['Alpha Savers']);
    expect(result2.map((g) => g.name)).toEqual(['Gamma Fund']);
  });

  it('currency filter does not leak between two separate calls', () => {
    const result1 = applyGroupFilters(groups, { currencyFilter: 'XLM' });
    const result2 = applyGroupFilters(groups, { currencyFilter: 'USDC' });

    expect(result1.every((g) => g.currency === 'XLM')).toBe(true);
    expect(result2.every((g) => g.currency === 'USDC')).toBe(true);
  });

  it('empty params returns all groups (no cross-contamination from previous call)', () => {
    // Call with an active filter first
    applyGroupFilters(groups, { searchQuery: 'Alpha', currencyFilter: 'XLM' });
    // Then call with empty params — must return all groups
    const result = applyGroupFilters(groups, {});
    expect(result).toHaveLength(3);
  });
});
