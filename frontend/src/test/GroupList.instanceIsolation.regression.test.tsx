/**
 * Regression tests for PR #1450: two GroupList instances on the same page
 * shared filter state through a common cache key, so searching in one list
 * filtered the other.
 *
 * Related: #16, #17 (issue #1548). Split out of the former
 * SearchBarSharedFiltering.regression.test.tsx — see #1917.
 */
import { act, render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { GroupList } from '../components/GroupList';

import type { Group } from '../components/GroupList';

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
