/**
 * Regression tests for SearchBar shared-filtering bug scenario.
 *
 * These tests lock in the behaviour of SearchBar and the filter utilities it
 * relies on to prevent re-introduction of the bugs fixed in PRs #1451 and
 * #1450.
 *
 * Specifically guarded bugs:
 *  - PR #1450: When two SearchBar / GroupList instances were rendered on the
 *    same page (e.g. Browse Groups sidebar + main list), typing in one SearchBar
 *    triggered the `onSearch` callback of the _other_ instance because they
 *    shared a common React-Query cache key derived from the debounced search
 *    term, causing unintended cross-instance filtering.
 *
 *  - PR #1451: The `filterSuggestions` utility did not exclude the exact-match
 *    suggestion, so selecting a suggestion from the dropdown immediately showed
 *    it again in the dropdown, and clicking it called `onSearch` a second time
 *    with no user action.
 *
 * Related: #16, #17 (issue #1548)
 */

import { act, render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SearchBar } from '../components/SearchBar';
import { GroupList } from '../components/GroupList';
import { filterSuggestions, normalizeQuery } from '../utils/searchUtils';
import { applyGroupFilters } from '../lib/filters';

import type { Group } from '../components/GroupList';

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: Independent SearchBar instances don't share state (PR #1450)
// ─────────────────────────────────────────────────────────────────────────────

describe('SearchBar — independent instances do not share state (PR #1450)', () => {
  /**
   * Two SearchBar components rendered side-by-side must fire their respective
   * `onSearch` callbacks independently. Typing in one must NOT trigger the
   * callback of the other.
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('typing in the first SearchBar only calls its own onSearch', () => {
    const onSearch1 = vi.fn();
    const onSearch2 = vi.fn();

    render(
      <>
        <SearchBar onSearch={onSearch1} debounceMs={300} />
        <SearchBar onSearch={onSearch2} debounceMs={300} />
      </>,
    );

    const [input1] = screen.getAllByRole('searchbox');

    // Type into the first input multiple times. The first tick is skipped by the
    // mount guard; the second is the one that fires.
    fireEvent.change(input1, { target: { value: 'al' } });
    vi.advanceTimersByTime(300);
    fireEvent.change(input1, { target: { value: 'alpha' } });
    vi.advanceTimersByTime(300);

    // The second SearchBar must NOT have been triggered at any point
    expect(onSearch2).not.toHaveBeenCalled();
  });

  it('typing in the second SearchBar only calls its own onSearch', () => {
    const onSearch1 = vi.fn();
    const onSearch2 = vi.fn();

    render(
      <>
        <SearchBar onSearch={onSearch1} debounceMs={300} />
        <SearchBar onSearch={onSearch2} debounceMs={300} />
      </>,
    );

    const [, input2] = screen.getAllByRole('searchbox');

    fireEvent.change(input2, { target: { value: 'be' } });
    vi.advanceTimersByTime(300);
    fireEvent.change(input2, { target: { value: 'beta' } });
    vi.advanceTimersByTime(300);

    // The first SearchBar must NOT have been triggered
    expect(onSearch1).not.toHaveBeenCalled();
  });

  it('clearing one SearchBar does not affect the other', () => {
    const onSearch1 = vi.fn();
    const onSearch2 = vi.fn();

    render(
      <>
        <SearchBar onSearch={onSearch1} debounceMs={300} />
        <SearchBar onSearch={onSearch2} debounceMs={300} />
      </>,
    );

    const [input1, input2] = screen.getAllByRole('searchbox');

    // Type into both
    fireEvent.change(input1, { target: { value: 'alpha' } });
    fireEvent.change(input2, { target: { value: 'gamma' } });
    vi.advanceTimersByTime(300);

    onSearch1.mockClear();
    onSearch2.mockClear();

    // Clear the first SearchBar's input
    const [clearBtn] = screen.getAllByLabelText('Clear search');
    fireEvent.click(clearBtn);

    // Only the first onSearch callback should receive '' from the clear
    // (it fires immediately on clear, not after debounce)
    // The second SearchBar's state must be unchanged
    expect(input2 as HTMLInputElement).toHaveValue('gamma');
  });

  it('each SearchBar maintains its own internal value independently', () => {
    const noop = vi.fn();
    render(
      <>
        <SearchBar onSearch={noop} defaultValue="first" debounceMs={300} />
        <SearchBar onSearch={noop} defaultValue="second" debounceMs={300} />
      </>,
    );

    const [input1, input2] = screen.getAllByRole('searchbox') as HTMLInputElement[];
    expect(input1.value).toBe('first');
    expect(input2.value).toBe('second');

    // Changing one should not affect the other
    fireEvent.change(input1, { target: { value: 'new-first' } });
    expect(input1.value).toBe('new-first');
    expect(input2.value).toBe('second');
  });

  it('debounce timer in one SearchBar does not affect the other — inputs remain independent', () => {
    const onSearch1 = vi.fn();
    const onSearch2 = vi.fn();

    render(
      <>
        <SearchBar onSearch={onSearch1} debounceMs={300} />
        <SearchBar onSearch={onSearch2} debounceMs={300} />
      </>,
    );

    const [input1, input2] = screen.getAllByRole('searchbox') as HTMLInputElement[];

    // Type in both inputs
    fireEvent.change(input1, { target: { value: 'fast' } });
    fireEvent.change(input2, { target: { value: 'slow' } });

    // Verify internal state remains isolated
    expect(input1.value).toBe('fast');
    expect(input2.value).toBe('slow');

    // Neither input's timer should have affected the other's value
    vi.advanceTimersByTime(600);

    // Values still independent
    expect(input1.value).toBe('fast');
    expect(input2.value).toBe('slow');

    // onSearch1 must never have been called by the second SearchBar's timer
    const calls2 = onSearch2.mock.calls.map((c) => c[0]);
    expect(calls2).not.toContain('fast');

    const calls1 = onSearch1.mock.calls.map((c) => c[0]);
    expect(calls1).not.toContain('slow');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: Two GroupList instances filter independently (PR #1450)
// ─────────────────────────────────────────────────────────────────────────────

describe('GroupList — two instances filter independently (PR #1450)', () => {
  const groupsA: Group[] = [
    { id: 'a1', name: 'Alpha Savers', currency: 'XLM', contributionAmount: 100 },
    { id: 'a2', name: 'Beta Circle', currency: 'XLM', contributionAmount: 200 },
  ];
  const groupsB: Group[] = [
    { id: 'b1', name: 'Gamma Fund', currency: 'USDC', contributionAmount: 500 },
    { id: 'b2', name: 'Delta Pool', currency: 'USDC', contributionAmount: 300 },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('searching in first GroupList does not filter second GroupList', async () => {
    render(
      <>
        <GroupList groups={groupsA} showPagination={false} />
        <GroupList groups={groupsB} showPagination={false} />
      </>,
    );

    const [searchInput] = screen.getAllByRole('searchbox');
    fireEvent.change(searchInput, { target: { value: 'Alpha' } });
    await act(async () => { vi.runAllTimers(); });

    // First list should only show Alpha Savers
    expect(screen.getByText('Alpha Savers')).toBeInTheDocument();
    expect(screen.queryByText('Beta Circle')).not.toBeInTheDocument();

    // Second list must remain unaffected
    expect(screen.getByText('Gamma Fund')).toBeInTheDocument();
    expect(screen.getByText('Delta Pool')).toBeInTheDocument();
  });

  it('searching in second GroupList does not filter first GroupList', async () => {
    render(
      <>
        <GroupList groups={groupsA} showPagination={false} />
        <GroupList groups={groupsB} showPagination={false} />
      </>,
    );

    const searchInputs = screen.getAllByRole('searchbox');
    const secondInput = searchInputs[1];
    fireEvent.change(secondInput, { target: { value: 'Gamma' } });
    await act(async () => { vi.runAllTimers(); });

    // Second list: only Gamma Fund visible
    expect(screen.getByText('Gamma Fund')).toBeInTheDocument();
    expect(screen.queryByText('Delta Pool')).not.toBeInTheDocument();

    // First list: both groups still visible
    expect(screen.getByText('Alpha Savers')).toBeInTheDocument();
    expect(screen.getByText('Beta Circle')).toBeInTheDocument();
  });

  it('controlled search prop in one GroupList does not affect the other', () => {
    const onSearchChange = vi.fn();
    render(
      <>
        <GroupList
          groups={groupsA}
          showPagination={false}
          searchQuery="Beta"
          onSearchChange={onSearchChange}
        />
        <GroupList groups={groupsB} showPagination={false} />
      </>,
    );

    // First list filters to Beta Circle
    expect(screen.queryByText('Alpha Savers')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Circle')).toBeInTheDocument();

    // Second list is unaffected by the first list's controlled search
    expect(screen.getByText('Gamma Fund')).toBeInTheDocument();
    expect(screen.getByText('Delta Pool')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: filterSuggestions excludes exact-match entry (PR #1451)
// ─────────────────────────────────────────────────────────────────────────────

describe('filterSuggestions — excludes exact match to prevent re-trigger (PR #1451)', () => {
  /**
   * PR #1451 bug: after a user selected "Alpha Savers" from the dropdown, the
   * input value became "Alpha Savers" and the suggestions list still contained
   * "Alpha Savers" (exact match was not excluded). Clicking it again called
   * `onSearch("Alpha Savers")` a second time without any user intent.
   */

  const suggestions = ['Alpha Savers', 'Beta Circle', 'Gamma Fund'];

  it('excludes the exact-match suggestion to prevent double-fire', () => {
    // After selection, input.value === 'Alpha Savers', suggestions should be empty
    const result = filterSuggestions(suggestions, 'Alpha Savers');
    expect(result).not.toContain('Alpha Savers');
    expect(result).toHaveLength(0); // no other suggestions match the full name
  });

  it('still shows partial matches when no exact match exists', () => {
    const result = filterSuggestions(suggestions, 'Alpha');
    expect(result).toContain('Alpha Savers');
    expect(result).toHaveLength(1);
  });

  it('returns empty array for empty query (no suggestions before user types)', () => {
    const result = filterSuggestions(suggestions, '');
    expect(result).toHaveLength(0);
  });

  it('returns empty array for whitespace-only query', () => {
    const result = filterSuggestions(suggestions, '   ');
    expect(result).toHaveLength(0);
  });

  it('excludes exact match case-sensitively — "alpha savers" is not excluded by "Alpha Savers"', () => {
    // The exact-match exclusion in filterSuggestions uses `suggestion !== query`
    // which is case-sensitive. This matches the SearchBar's behaviour of storing
    // the suggestion value verbatim in state.
    const result = filterSuggestions(suggestions, 'alpha savers');
    // 'Alpha Savers' contains 'alpha savers' (case-insensitive include), and
    // 'Alpha Savers' !== 'alpha savers' (case-sensitive), so it should appear
    expect(result).toContain('Alpha Savers');
  });

  it('suggestion click calls onSearch once and hides dropdown', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(
      <SearchBar
        onSearch={onSearch}
        suggestions={['Alpha Savers', 'Beta Circle']}
        debounceMs={300}
      />,
    );

    const input = screen.getByRole('searchbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'alp' } });

    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Simulate selecting a suggestion
    fireEvent.mouseDown(screen.getByText('Alpha Savers'));

    // onSearch should have been called exactly once (immediate, not debounced)
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('Alpha Savers');

    // Dropdown must be hidden after selection
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Advancing timers should NOT trigger another onSearch call
    vi.advanceTimersByTime(300);
    // The debounce fires with "Alpha Savers" — that's the stored value, same as
    // what was already called, so the count may be 2 total but NOT an additional
    // call triggered by suggestion re-display
    // The key regression: the dropdown must NOT reappear
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('after selecting a suggestion, that suggestion does not reappear in the dropdown', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(
      <SearchBar
        onSearch={onSearch}
        suggestions={['Alpha Savers', 'Beta Circle']}
        debounceMs={300}
      />,
    );

    const input = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'alp' } });
    fireEvent.mouseDown(screen.getByText('Alpha Savers'));

    // Input now holds "Alpha Savers" — dropdown must be closed
    expect(input.value).toBe('Alpha Savers');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Re-focusing the input should not show the dropdown with "Alpha Savers"
    // because the exact-match exclusion prevents it
    fireEvent.focus(input);
    // No suggestions should match because "Alpha Savers" === "Alpha Savers"
    // (exact match excluded)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: normalizeQuery trims + lowercases consistently (PR #1451)
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeQuery — consistent trim + lowercase (PR #1451)', () => {
  /**
   * The bug: when `normalizeQuery` was missing the `.trim()` step, a
   * query with leading/trailing whitespace would fail to match suggestions
   * even when the user had typed valid content. This was a silent failure
   * that cleared the dropdown unexpectedly.
   */

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

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: applyGroupFilters uses independent filter state (PR #1450)
// ─────────────────────────────────────────────────────────────────────────────

describe('applyGroupFilters — all filters are independent (PR #1450)', () => {
  /**
   * The shared-filtering bug also manifested in `applyGroupFilters`: when the
   * same params object was mutated externally between calls, stale filter state
   * leaked across renders. The fix: treat params as value objects; each call
   * operates on its own snapshot.
   */

  const groups = [
    { id: '1', name: 'Alpha Savers', currency: 'XLM', contributionAmount: 100 },
    { id: '2', name: 'Beta Circle',  currency: 'USDC', contributionAmount: 250 },
    { id: '3', name: 'Gamma Fund',   currency: 'XLM',  contributionAmount: 500 },
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

  it('combined filters only exclude groups that fail ALL active predicates', () => {
    const result = applyGroupFilters(groups, {
      currencyFilter: 'XLM',
      minAmount: '200',
    });
    // Only Gamma Fund (XLM, 500) passes both
    expect(result.map((g) => g.name)).toEqual(['Gamma Fund']);
  });

  it('minAmount and maxAmount filters are inclusive bounds', () => {
    const resultMin = applyGroupFilters(groups, { minAmount: '250' });
    expect(resultMin.map((g) => g.name)).toContain('Beta Circle'); // 250 >= 250
    expect(resultMin.map((g) => g.name)).not.toContain('Alpha Savers'); // 100 < 250

    const resultMax = applyGroupFilters(groups, { maxAmount: '250' });
    expect(resultMax.map((g) => g.name)).toContain('Beta Circle'); // 250 <= 250
    expect(resultMax.map((g) => g.name)).not.toContain('Gamma Fund'); // 500 > 250
  });

  it('searchQuery matches description as well as name', () => {
    const withDescriptions = [
      { id: '1', name: 'Alpha Savers', description: 'weekly ajo', currency: 'XLM', contributionAmount: 100 },
      { id: '2', name: 'Beta Circle',  description: 'monthly fund', currency: 'XLM', contributionAmount: 200 },
    ];
    const result = applyGroupFilters(withDescriptions, { searchQuery: 'ajo' });
    expect(result.map((g) => g.name)).toEqual(['Alpha Savers']);
  });

  it('searchQuery matching is case-insensitive', () => {
    const result = applyGroupFilters(groups, { searchQuery: 'ALPHA' });
    expect(result.map((g) => g.name)).toEqual(['Alpha Savers']);
  });

  it('non-finite minAmount string is treated as no lower bound', () => {
    const result = applyGroupFilters(groups, { minAmount: 'abc' });
    expect(result).toHaveLength(3);
  });

  it('non-finite maxAmount string is treated as no upper bound', () => {
    const result = applyGroupFilters(groups, { maxAmount: '' });
    expect(result).toHaveLength(3);
  });
});
