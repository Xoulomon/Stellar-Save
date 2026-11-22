import { describe, it, expect } from 'vitest';
import {
  filterGroups,
  sortGroups,
  groupByStatus,
  paginateGroups,
  queryGroups,
  type GroupLike,
  type SortConfig,
} from './groupListQueries';

const make = (over: Partial<GroupLike> & { id: string; name: string }): GroupLike => over;

const fixture: GroupLike[] = [
  make({ id: '1', name: 'Alpha', description: 'savings', memberCount: 10, contributionAmount: 100, currency: 'XLM', createdAt: new Date('2024-01-01') }),
  make({ id: '2', name: 'Beta', description: 'vacation', memberCount: 5, contributionAmount: 250, currency: 'USDC', createdAt: new Date('2024-02-01') }),
  make({ id: '3', name: 'Gamma', memberCount: 25, contributionAmount: 500, currency: 'XLM', createdAt: new Date('2024-03-01') }),
  make({ id: '4', name: 'delta', memberCount: 5 }),
];

// ─── sortGroups: table-driven across every sort key and order ─────────────────

describe('sortGroups', () => {
  const cases: Array<{ label: string; config: SortConfig; expectedIds: string[] }> = [
    { label: 'name asc', config: { field: 'name', order: 'asc' }, expectedIds: ['1', '4', '2', '3'] },
    { label: 'name desc', config: { field: 'name', order: 'desc' }, expectedIds: ['3', '2', '4', '1'] },
    { label: 'memberCount asc', config: { field: 'memberCount', order: 'asc' }, expectedIds: ['4', '2', '1', '3'] },
    { label: 'memberCount desc', config: { field: 'memberCount', order: 'desc' }, expectedIds: ['3', '1', '2', '4'] },
    { label: 'createdAt asc', config: { field: 'createdAt', order: 'asc' }, expectedIds: ['1', '2', '3', '4'] },
    { label: 'createdAt desc', config: { field: 'createdAt', order: 'desc' }, expectedIds: ['3', '2', '1', '4'] },
  ];

  it.each(cases)('sorts by $label', ({ config, expectedIds }) => {
    const result = sortGroups(fixture, config);
    expect(result.map((g) => g.id)).toEqual(expectedIds);
  });

  it.each(['name', 'memberCount', 'createdAt'] as const)('returns empty array for empty input sorting by %s', (field) => {
    expect(sortGroups([], { field, order: 'asc' })).toEqual([]);
    expect(sortGroups([], { field, order: 'desc' })).toEqual([]);
  });

  it('does not mutate the input array', () => {
    const input = [...fixture];
    sortGroups(input, { field: 'name', order: 'desc' });
    expect(input.map((g) => g.id)).toEqual(['1', '2', '3', '4']);
  });
});

// ─── filterGroups: table-driven across filter combinations ────────────────────

describe('filterGroups', () => {
  const cases: Array<{ label: string; params: Record<string, string>; expectedIds: string[] }> = [
    { label: 'no filters', params: {}, expectedIds: ['1', '2', '3', '4'] },
    { label: 'empty-string filters behave as no-op', params: { searchQuery: '', currencyFilter: '', minAmount: '', maxAmount: '' }, expectedIds: ['1', '2', '3', '4'] },
    { label: 'search by name (case-insensitive)', params: { searchQuery: 'alp' }, expectedIds: ['1'] },
    { label: 'search by description', params: { searchQuery: 'vacation' }, expectedIds: ['2'] },
    { label: 'search with no match', params: { searchQuery: 'zzz' }, expectedIds: [] },
    { label: 'currency XLM', params: { currencyFilter: 'XLM' }, expectedIds: ['1', '3'] },
    { label: 'currency case-insensitive', params: { currencyFilter: 'usdc' }, expectedIds: ['2'] },
    { label: 'minAmount', params: { minAmount: '200' }, expectedIds: ['2', '3'] },
    { label: 'maxAmount', params: { maxAmount: '200' }, expectedIds: ['1'] },
    { label: 'min + max range', params: { minAmount: '150', maxAmount: '300' }, expectedIds: ['2'] },
    { label: 'currency + minAmount', params: { currencyFilter: 'XLM', minAmount: '300' }, expectedIds: ['3'] },
    { label: 'search + currency', params: { searchQuery: 'a', currencyFilter: 'XLM' }, expectedIds: ['1', '3'] },
  ];

  it.each(cases)('$label', ({ params, expectedIds }) => {
    expect(filterGroups(fixture, params).map((g) => g.id)).toEqual(expectedIds);
  });

  it('returns empty array for empty input', () => {
    expect(filterGroups([], { searchQuery: 'a' })).toEqual([]);
  });
});

// ─── groupByStatus ────────────────────────────────────────────────────────────

describe('groupByStatus', () => {
  const withStatus = [
    make({ id: '1', name: 'A', status: 'active' }),
    make({ id: '2', name: 'B', status: 'pending' }),
    make({ id: '3', name: 'C', status: 'active' }),
    make({ id: '4', name: 'D' }),
  ];

  it('groups by status and buckets missing status as unknown', () => {
    const grouped = groupByStatus(withStatus);
    expect(grouped.active.map((g) => g.id)).toEqual(['1', '3']);
    expect(grouped.pending.map((g) => g.id)).toEqual(['2']);
    expect(grouped.unknown.map((g) => g.id)).toEqual(['4']);
  });

  it('returns empty object for empty input', () => {
    expect(groupByStatus([])).toEqual({});
  });
});

// ─── paginateGroups ───────────────────────────────────────────────────────────

describe('paginateGroups', () => {
  const items = Array.from({ length: 25 }, (_, i) => make({ id: String(i + 1), name: `G${i + 1}` }));

  it('returns the first page', () => {
    expect(paginateGroups(items, 1, 10)).toHaveLength(10);
    expect(paginateGroups(items, 1, 10)[0].id).toBe('1');
  });

  it('returns the last partial page', () => {
    const page = paginateGroups(items, 3, 10);
    expect(page).toHaveLength(5);
    expect(page[0].id).toBe('21');
  });

  it('returns everything when pagination is disabled', () => {
    expect(paginateGroups(items, 1, 10, false)).toHaveLength(25);
  });

  it('returns empty array for empty input', () => {
    expect(paginateGroups([], 1, 10)).toEqual([]);
  });
});

// ─── queryGroups: full pipeline ───────────────────────────────────────────────

describe('queryGroups', () => {
  it('filters, sorts, and paginates in one call', () => {
    const result = queryGroups(fixture, {
      searchQuery: '',
      currencyFilter: 'XLM',
      sort: { field: 'memberCount', order: 'desc' },
      page: 1,
      pageSize: 1,
    });
    expect(result.items.map((g) => g.id)).toEqual(['3']);
    expect(result.totalCount).toBe(2);
    expect(result.totalPages).toBe(2);
  });

  it('returns empty items, zero totals for empty input', () => {
    const result = queryGroups([], {
      sort: { field: 'name', order: 'asc' },
      page: 1,
      pageSize: 10,
    });
    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.totalPages).toBe(0);
  });

  it('returns full list when paginate is false', () => {
    const result = queryGroups(fixture, {
      sort: { field: 'name', order: 'asc' },
      page: 1,
      pageSize: 2,
      paginate: false,
    });
    expect(result.items).toHaveLength(4);
    expect(result.totalPages).toBe(2);
  });
});
