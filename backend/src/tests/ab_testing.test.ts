/**
 * Unit tests for A/B Testing Framework (Issue #1700)
 */

import { ABTestingFramework, TestBucket } from '../ab_testing';

describe('ABTestingFramework', () => {
  it('deterministically assigns the same bucket to a user', () => {
    const ab = new ABTestingFramework();
    const bucket1 = ab.getBucket('user-12345');
    const bucket2 = ab.getBucket('user-12345');
    expect(bucket1).toBe(bucket2);
    expect(['A', 'B']).toContain(bucket1);
  });

  it('correctly reports isInBucket status', () => {
    const ab = new ABTestingFramework();
    const bucket = ab.getBucket('user-test-abc');
    expect(ab.isInBucket('user-test-abc', 'ANY_EXP', bucket)).toBe(true);
    const opposite: TestBucket = bucket === 'A' ? 'B' : 'A';
    expect(ab.isInBucket('user-test-abc', 'ANY_EXP', opposite)).toBe(false);
  });

  it('accepts custom injected bucket store', () => {
    const mockStore = new Map<string, TestBucket>();
    mockStore.set('preset-user', 'B');

    const ab = new ABTestingFramework({ bucketStore: mockStore });
    expect(ab.getBucket('preset-user')).toBe('B');

    ab.getBucket('new-user');
    expect(mockStore.has('new-user')).toBe(true);
  });
});
