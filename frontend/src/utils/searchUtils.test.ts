import { describe, it, expect } from 'vitest';

import { normalizeQuery, filterSuggestions } from './searchUtils';

describe('normalizeQuery', () => {
  it('trims and lowercases the query', () => {
    expect(normalizeQuery('  Alpha  ')).toBe('alpha');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizeQuery('   ')).toBe('');
  });
});

describe('filterSuggestions', () => {
  const suggestions = ['Alpha Savers', 'Beta Circle', 'Gamma Fund'];

  it('returns an empty array when the query is empty', () => {
    expect(filterSuggestions(suggestions, '')).toEqual([]);
  });

  it('returns an empty array when the query is whitespace only', () => {
    expect(filterSuggestions(suggestions, '   ')).toEqual([]);
  });

  it('matches suggestions case-insensitively', () => {
    expect(filterSuggestions(suggestions, 'alp')).toEqual(['Alpha Savers']);
  });

  it('matches suggestions containing the query anywhere in the string', () => {
    expect(filterSuggestions(suggestions, 'circle')).toEqual(['Beta Circle']);
  });

  it('excludes a suggestion that exactly matches the query', () => {
    expect(filterSuggestions(suggestions, 'Alpha Savers')).toEqual([]);
  });

  it('returns an empty array when nothing matches', () => {
    expect(filterSuggestions(suggestions, 'zzz')).toEqual([]);
  });
});
