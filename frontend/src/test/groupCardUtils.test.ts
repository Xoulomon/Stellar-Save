import { computeNextPayout } from '../utils/groupCardUtils';

describe('computeNextPayout', () => {
  const startedAt = new Date('2024-01-01T00:00:00Z');

  it('returns null when startedAt is null', () => {
    expect(computeNextPayout(null, 0, 3600)).toBeNull();
  });

  it('returns null when cycleDurationSecs is zero', () => {
    expect(computeNextPayout(startedAt, 0, 0)).toBeNull();
  });

  it('returns null when cycleDurationSecs is negative', () => {
    expect(computeNextPayout(startedAt, 0, -3600)).toBeNull();
  });

  it('computes the end of the first cycle when currentCycle is 0', () => {
    const result = computeNextPayout(startedAt, 0, 3600); // 1 hour cycles
    expect(result).toEqual(new Date('2024-01-01T01:00:00Z'));
  });

  it('computes the end of a later cycle', () => {
    const result = computeNextPayout(startedAt, 4, 3600); // 5th cycle (0-indexed)
    expect(result).toEqual(new Date('2024-01-01T05:00:00Z'));
  });

  it('handles a maximally large currentCycle without overflowing to an invalid date', () => {
    const result = computeNextPayout(startedAt, 100, 86400); // 100 daily cycles
    // 2024 is a leap year: Jan(31) + Feb(29) + Mar(31) = 91 days to Apr 1,
    // plus 10 more days of the 101-day offset (currentCycle + 1) lands on Apr 11.
    expect(result).toEqual(new Date('2024-04-11T00:00:00Z'));
    expect(result).not.toBeNull();
    expect(Number.isNaN(result!.getTime())).toBe(false);
  });
});
