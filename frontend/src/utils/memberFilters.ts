import type { MemberProfile, MemberDirectoryFilters, MemberSortOption } from '../types/member';

/**
 * Pure filtering function for member directory
 */
export function applyFilters(members: MemberProfile[], filters: MemberDirectoryFilters): MemberProfile[] {
  let result = members;

  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (m) =>
        m.address.toLowerCase().includes(q) ||
        (m.name ? m.name.toLowerCase().includes(q) : false)
    );
  }

  if (filters.status !== 'all') {
    result = result.filter((m) => m.status === filters.status);
  }

  if (filters.hasReceivedPayout !== 'all') {
    const want = filters.hasReceivedPayout === 'yes';
    result = result.filter((m) => m.hasReceivedPayout === want);
  }

  return result;
}

/**
 * Pure sorting function for member directory
 */
export function applySort(members: MemberProfile[], sort: MemberSortOption): MemberProfile[] {
  return [...members].sort((a, b) => {
    switch (sort) {
      case 'contributions-desc':
        return b.contributionCount - a.contributionCount;
      case 'contributions-asc':
        return a.contributionCount - b.contributionCount;
      case 'join-date-desc':
        return b.joinDate.getTime() - a.joinDate.getTime();
      case 'join-date-asc':
        return a.joinDate.getTime() - b.joinDate.getTime();
      case 'name-asc':
        return (a.name ?? a.address).localeCompare(b.name ?? b.address);
      case 'name-desc':
        return (b.name ?? b.address).localeCompare(a.name ?? a.address);
      case 'payout-position-asc':
        return a.payoutPosition - b.payoutPosition;
      case 'payout-position-desc':
        return b.payoutPosition - a.payoutPosition;
      default:
        return 0;
    }
  });
}
