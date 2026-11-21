/**
 * Regression tests for PR #1450: two SearchBar instances on the same page
 * (e.g. Browse Groups sidebar + main list) shared a React-Query cache key
 * derived from the debounced search term, so typing in one SearchBar
 * triggered the other instance's `onSearch`.
 *
 * Related: #16, #17 (issue #1548). Split out of the former
 * SearchBarSharedFiltering.regression.test.tsx — see #1917.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SearchBar } from '../components/SearchBar';

describe('SearchBar — independent instances do not share state (PR #1450)', () => {
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
