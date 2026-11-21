/**
 * Regression tests for PR #1451: `filterSuggestions` did not exclude the
 * exact-match suggestion, so selecting a suggestion from the dropdown
 * immediately showed it again, and clicking it called `onSearch` a second
 * time with no user action.
 *
 * Related: #16, #17 (issue #1548). Split out of the former
 * SearchBarSharedFiltering.regression.test.tsx — see #1917.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { SearchBar } from '../components/SearchBar';
import { filterSuggestions } from '../utils/searchUtils';

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
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
