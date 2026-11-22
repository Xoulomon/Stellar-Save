import { calculateScore, getMemberReputation } from '../reputation_service';
import { ReputationFactory } from '../../test/fixtures/factory';

describe('calculateScore', () => {
  it('returns 0 when totalContributions is 0', () => {
    expect(calculateScore(0, 0)).toBe(0);
  });

  it('returns 1.0 for perfect on-time record', () => {
    expect(calculateScore(10, 10)).toBe(1);
  });

  it('returns 0.5 for half on-time', () => {
    expect(calculateScore(10, 5)).toBe(0.5);
  });

  it('returns 0.0 for zero on-time contributions', () => {
    expect(calculateScore(5, 0)).toBe(0);
  });

  it('clamps to [0, 1]', () => {
    expect(calculateScore(5, 10)).toBe(1); // onTime > total (edge case)
    expect(calculateScore(5, -1)).toBe(0); // negative (edge case)
  });

  it('handles fractional results', () => {
    const score = calculateScore(3, 2);
    expect(score).toBeCloseTo(0.667, 2);
  });
});

describe('getMemberReputation', () => {
  it('returns a default record when Prisma is unavailable', async () => {
    const expected = ReputationFactory.buildDefaultReputation('GTEST123');
    const result = await getMemberReputation('GTEST123');
    expect(result).toMatchObject({
      address: expected.address,
      score: expected.score,
      totalContributions: expected.totalContributions,
      onTimeContributions: expected.onTimeContributions,
    });
    expect(typeof result.updatedAt).toBe('string');
  });
});
