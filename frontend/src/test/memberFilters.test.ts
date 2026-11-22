import { describe, it, expect } from 'vitest';
import { applyFilters, applySort } from '../utils/memberFilters';
import type { MemberProfile, MemberDirectoryFilters } from '../types/member';
import { DEFAULT_MEMBER_FILTERS } from '../types/member';

function makeTestMember(overrides: Partial<MemberProfile>): MemberProfile {
  return {
    address: 'GABC1234567890',
    name: 'Test Member',
    joinDate: new Date('2026-01-01'),
    contributionCount: 5,
    totalContributed: 500,
    payoutPosition: 1,
    totalMembers: 10,
    hasReceivedPayout: false,
    status: 'active',
    ...overrides,
  };
}

const MEMBERS: MemberProfile[] = [
  makeTestMember({
    address: 'GALICE11111111',
    name: 'Alice',
    joinDate: new Date('2026-01-10'),
    contributionCount: 10,
    payoutPosition: 1,
    hasReceivedPayout: true,
    status: 'active',
  }),
  makeTestMember({
    address: 'GBOB2222222222',
    name: 'Bob',
    joinDate: new Date('2026-02-15'),
    contributionCount: 5,
    payoutPosition: 2,
    hasReceivedPayout: false,
    status: 'inactive',
  }),
  makeTestMember({
    address: 'GCAROL33333333',
    name: 'Carol',
    joinDate: new Date('2026-03-20'),
    contributionCount: 2,
    payoutPosition: 3,
    hasReceivedPayout: false,
    status: 'pending',
  }),
];

describe('memberFilters pure utility', () => {
  describe('applyFilters', () => {
    it('returns all members when default filters are passed', () => {
      const result = applyFilters(MEMBERS, DEFAULT_MEMBER_FILTERS);
      expect(result.length).toBe(3);
    });

    it('filters by search term (name and address)', () => {
      const nameMatch = applyFilters(MEMBERS, { ...DEFAULT_MEMBER_FILTERS, search: 'alice' });
      expect(nameMatch.length).toBe(1);
      expect(nameMatch[0].name).toBe('Alice');

      const addrMatch = applyFilters(MEMBERS, { ...DEFAULT_MEMBER_FILTERS, search: 'GBOB' });
      expect(addrMatch.length).toBe(1);
      expect(addrMatch[0].name).toBe('Bob');
    });

    it('filters by status', () => {
      const activeOnly = applyFilters(MEMBERS, { ...DEFAULT_MEMBER_FILTERS, status: 'active' });
      expect(activeOnly.length).toBe(1);
      expect(activeOnly[0].name).toBe('Alice');

      const pendingOnly = applyFilters(MEMBERS, { ...DEFAULT_MEMBER_FILTERS, status: 'pending' });
      expect(pendingOnly.length).toBe(1);
      expect(pendingOnly[0].name).toBe('Carol');
    });

    it('filters by payout received status', () => {
      const received = applyFilters(MEMBERS, { ...DEFAULT_MEMBER_FILTERS, hasReceivedPayout: 'yes' });
      expect(received.length).toBe(1);
      expect(received[0].name).toBe('Alice');

      const pending = applyFilters(MEMBERS, { ...DEFAULT_MEMBER_FILTERS, hasReceivedPayout: 'no' });
      expect(pending.length).toBe(2);
    });

    it('handles combined filters', () => {
      const combined: MemberDirectoryFilters = {
        search: 'b',
        status: 'inactive',
        hasReceivedPayout: 'no',
        sort: 'contributions-desc',
      };
      const result = applyFilters(MEMBERS, combined);
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Bob');
    });
  });

  describe('applySort', () => {
    it('sorts by contribution count descending and ascending', () => {
      const desc = applySort(MEMBERS, 'contributions-desc');
      expect(desc.map((m) => m.name)).toEqual(['Alice', 'Bob', 'Carol']);

      const asc = applySort(MEMBERS, 'contributions-asc');
      expect(asc.map((m) => m.name)).toEqual(['Carol', 'Bob', 'Alice']);
    });

    it('sorts by name ascending and descending', () => {
      const asc = applySort(MEMBERS, 'name-asc');
      expect(asc.map((m) => m.name)).toEqual(['Alice', 'Bob', 'Carol']);

      const desc = applySort(MEMBERS, 'name-desc');
      expect(desc.map((m) => m.name)).toEqual(['Carol', 'Bob', 'Alice']);
    });

    it('sorts by join date newest and oldest', () => {
      const newest = applySort(MEMBERS, 'join-date-desc');
      expect(newest.map((m) => m.name)).toEqual(['Carol', 'Bob', 'Alice']);

      const oldest = applySort(MEMBERS, 'join-date-asc');
      expect(oldest.map((m) => m.name)).toEqual(['Alice', 'Bob', 'Carol']);
    });

    it('sorts by payout position', () => {
      const asc = applySort(MEMBERS, 'payout-position-asc');
      expect(asc.map((m) => m.payoutPosition)).toEqual([1, 2, 3]);

      const desc = applySort(MEMBERS, 'payout-position-desc');
      expect(desc.map((m) => m.payoutPosition)).toEqual([3, 2, 1]);
    });
  });
});
