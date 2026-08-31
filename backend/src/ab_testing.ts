export type TestBucket = 'A' | 'B';

export class ABTestingFramework {
  // In a real app, this would be persisted in a DB
  private userBuckets: Map<string, TestBucket> = new Map();

  getBucket(userId: string): TestBucket {
    if (this.userBuckets.has(userId)) {
      return this.userBuckets.get(userId)!;
    }

    // Assign bucket based on hash of userId
    const hash = this.simpleHash(userId);
    const bucket: TestBucket = hash % 2 === 0 ? 'A' : 'B';
    this.userBuckets.set(userId, bucket);
    return bucket;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
