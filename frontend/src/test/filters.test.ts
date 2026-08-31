import { describe, it, expect } from 'vitest';
import {
  matchesSearchQuery,
  matchesCurrency,
  matchesMinAmount,
  matchesMaxAmount,
  applyGroupFilters,
  type FilterableGroup,
} from '../lib/filters';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const alpha: FilterableGroup = {
  name: 'Alpha Circle',
  description: 'A great savings circle',
  currency: 'XLM',
  contributionAmount: 100,
};

const beta: FilterableGroup = {
  name: 'Beta Pool',
  description: undefined,
  currency: 'USDC',
  contributionAmount: 250,
};

const gamma: FilterableGroup = {
  name: 'Gamma Fund',
  description: 'Long-term savings',
  currency: 'XLM',
  contributionAmount: 500,
};

const noAmount: FilterableGroup = {
  name: 'Delta Group',
  currency: 'XLM',
  contributionAmount: undefined,
};

// ─── matchesSearchQuery ───────────────────────────────────────────────────────

describe('matchesSearchQuery', () => {
  it('matches when query appears in group name (case-insensitive)', () => {
    expect(matchesSearchQuery(alpha, 'alpha')).toBe(true);
    expect(matchesSearchQuery(alpha, 'ALPHA')).toBe(true);
    expect(matchesSearchQuery(alpha, 'Alp')).toBe(true);
  });

  it('matches when query appears in description', () => {
    expect(matchesSearchQuery(alpha, 'great')).toBe(true);
  });

  it('returns false when neither name nor description contains query', () => {
    expect(matchesSearchQuery(alpha, 'zzz')).toBe(false);
  });

  it('matches everything when query is empty string', () => {
    expect(matchesSearchQuery(alpha, '')).toBe(true);
  });

  it('matches everything when query is whitespace only', () => {
    expect(matchesSearchQuery(alpha, '   ')).toBe(true);
  });

  it('does not throw when description is undefined', () => {
    expect(matchesSearchQuery(beta, 'pool')).toBe(true);
    expect(matchesSearchQuery(beta, 'something-that-would-be-in-desc')).toBe(false);
  });

  it('handles special characters in query without throwing', () => {
    expect(() => matchesSearchQuery(alpha, '.*?[alpha]')).not.toThrow();
  });

  it('handles unicode characters', () => {
    const group: FilterableGroup = { name: 'Épargne Group', currency: 'EUR' };
    expect(matchesSearchQuery(group, 'épargne')).toBe(true);
  });
});

// ─── matchesCurrency ─────────────────────────────────────────────────────────

describe('matchesCurrency', () => {
  it('matches the exact currency (case-insensitive)', () => {
    expect(matchesCurrency(alpha, 'XLM')).toBe(true);
    expect(matchesCurrency(alpha, 'xlm')).toBe(true);
    expect(matchesCurrency(beta, 'USDC')).toBe(true);
  });

  it('returns false when currency does not match', () => {
    expect(matchesCurrency(alpha, 'USDC')).toBe(false);
    expect(matchesCurrency(beta, 'XLM')).toBe(false);
  });

  it('matches everything when filter is empty string', () => {
    expect(matchesCurrency(alpha, '')).toBe(true);
    expect(matchesCurrency(beta, '')).toBe(true);
  });

  it('matches everything when filter is whitespace only', () => {
    expect(matchesCurrency(alpha, '  ')).toBe(true);
  });

  it('handles group with undefined currency gracefully', () => {
    const noCurrency: FilterableGroup = { name: 'No Currency Group' };
    expect(matchesCurrency(noCurrency, 'XLM')).toBe(false);
    expect(matchesCurrency(noCurrency, '')).toBe(true);
  });
});

// ─── matchesMinAmount ─────────────────────────────────────────────────────────

describe('matchesMinAmount', () => {
  it('returns true when amount equals min (inclusive)', () => {
    expect(matchesMinAmount(alpha, '100')).toBe(true);
  });

  it('returns true when amount is above min', () => {
    expect(matchesMinAmount(gamma, '100')).toBe(true);
  });

  it('returns false when amount is below min', () => {
    expect(matchesMinAmount(alpha, '200')).toBe(false);
  });

  it('returns true when min is empty string (no lower bound)', () => {
    expect(matchesMinAmount(alpha, '')).toBe(true);
  });

  it('returns true when min is whitespace only', () => {
    expect(matchesMinAmount(alpha, '  ')).toBe(true);
  });

  it('returns true for non-numeric min (treat as no bound)', () => {
    expect(matchesMinAmount(alpha, 'abc')).toBe(true);
  });

  it('handles group with undefined contributionAmount (treated as 0)', () => {
    expect(matchesMinAmount(noAmount, '0')).toBe(true);
    expect(matchesMinAmount(noAmount, '1')).toBe(false);
  });

  it('handles negative min amount', () => {
    expect(matchesMinAmount(alpha, '-50')).toBe(true);
  });
});

// ─── matchesMaxAmount ─────────────────────────────────────────────────────────

describe('matchesMaxAmount', () => {
  it('returns true when amount equals max (inclusive)', () => {
    expect(matchesMaxAmount(alpha, '100')).toBe(true);
  });

  it('returns true when amount is below max', () => {
    expect(matchesMaxAmount(alpha, '500')).toBe(true);
  });

  it('returns false when amount is above max', () => {
    expect(matchesMaxAmount(gamma, '200')).toBe(false);
  });

  it('returns true when max is empty string (no upper bound)', () => {
    expect(matchesMaxAmount(gamma, '')).toBe(true);
  });

  it('returns true when max is whitespace only', () => {
    expect(matchesMaxAmount(gamma, '   ')).toBe(true);
  });

  it('returns true for non-numeric max (treat as no bound)', () => {
    expect(matchesMaxAmount(gamma, 'abc')).toBe(true);
  });

  it('handles group with undefined contributionAmount (treated as 0)', () => {
    expect(matchesMaxAmount(noAmount, '0')).toBe(true);
    expect(matchesMaxAmount(noAmount, '100')).toBe(true);
  });
});

// ─── applyGroupFilters ────────────────────────────────────────────────────────

describe('applyGroupFilters', () => {
  const groups = [alpha, beta, gamma];

  it('returns all groups when no filters are provided', () => {
    expect(applyGroupFilters(groups, {})).toHaveLength(3);
  });

  it('filters by search query', () => {
    const result = applyGroupFilters(groups, { searchQuery: 'alpha' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha Circle');
  });

  it('filters by currency', () => {
    const result = applyGroupFilters(groups, { currencyFilter: 'XLM' });
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.name)).toEqual(['Alpha Circle', 'Gamma Fund']);
  });

  it('filters by minAmount', () => {
    const result = applyGroupFilters(groups, { minAmount: '200' });
    expect(result).toHaveLength(2);
    expect(result.map((g) => g.name)).toEqual(['Beta Pool', 'Gamma Fund']);
  });

  it('filters by maxAmount', () => {
    const result = applyGroupFilters(groups, { maxAmount: '200' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha Circle');
  });

  it('combines currency and minAmount filters', () => {
    const result = applyGroupFilters(groups, { currencyFilter: 'XLM', minAmount: '300' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Gamma Fund');
  });

  it('combines search query and maxAmount', () => {
    const result = applyGroupFilters(groups, { searchQuery: 'fund', maxAmount: '600' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Gamma Fund');
  });

  it('returns empty array when no groups match', () => {
    expect(applyGroupFilters(groups, { searchQuery: 'zzz-no-match' })).toHaveLength(0);
  });

  it('returns empty array when input is empty', () => {
    expect(applyGroupFilters([], { searchQuery: 'alpha' })).toHaveLength(0);
  });

  it('handles empty query — should return all groups', () => {
    expect(applyGroupFilters(groups, { searchQuery: '' })).toHaveLength(3);
  });

  it('handles whitespace-only query — should return all groups', () => {
    expect(applyGroupFilters(groups, { searchQuery: '   ' })).toHaveLength(3);
  });

  it('handles special characters in search query without throwing', () => {
    expect(() =>
      applyGroupFilters(groups, { searchQuery: '(.*?)[(special)]' }),
    ).not.toThrow();
  });

  it('applies all four filters simultaneously', () => {
    const result = applyGroupFilters(groups, {
      searchQuery: 'fund',
      currencyFilter: 'XLM',
      minAmount: '400',
      maxAmount: '600',
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Gamma Fund');
  });

  it('is case-insensitive for both search and currency', () => {
    const result = applyGroupFilters(groups, {
      searchQuery: 'ALPHA',
      currencyFilter: 'xlm',
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha Circle');
  });
});
