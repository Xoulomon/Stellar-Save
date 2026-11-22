/**
 * A/B Testing Framework (Issue #1700 — Audit)
 *
 * All previously-defined experiments have been concluded and their gating code
 * removed from consuming features.  This module now contains only the
 * reusable bucketing infrastructure.
 *
 * ── Experiment retirement process ──────────────────────────────────────────
 * 1. Confirm the experiment has a decision recorded in the product roadmap.
 * 2. Remove the experiment constant and any feature-gating code that
 *    references it (search for `getBucket` / experiment name across the
 *    codebase).
 * 3. Update or remove related A/B analytics events so dashboards stay clean.
 * 4. Open a PR referencing this checklist and the decision document.
 * ──────────────────────────────────────────────────────────────────────────
 *
 * When a new experiment is needed, add it as a named constant below and
 * gate the feature behind `isInBucket(userId, EXPERIMENT_NAME, 'B')`.
 */

export type TestBucket = 'A' | 'B';

/**
 * Active experiment definitions.
 *
 * Add new experiments here.  When an experiment concludes, delete its entry
 * and remove all consuming feature code that branches on it.
 *
 * Format: `export const EXP_<NAME> = '<descriptive-key>';`
 */
// -- No active experiments as of 2026-09-26 (all concluded experiments removed) --

export interface ABTestingDeps {
  /** Optional persistent store for bucket assignments (defaults to in-memory Map). */
  bucketStore?: {
    get(userId: string): TestBucket | undefined;
    set(userId: string, bucket: TestBucket): void;
    has(userId: string): boolean;
  };
}

export class ABTestingFramework {
  private readonly bucketStore: NonNullable<ABTestingDeps['bucketStore']>;

  constructor(deps: ABTestingDeps = {}) {
    this.bucketStore = deps.bucketStore ?? new Map<string, TestBucket>();
  }

  /**
   * Deterministically assign a user to a bucket.
   * The result is stable for the same userId.
   */
  getBucket(userId: string): TestBucket {
    if (this.bucketStore.has(userId)) {
      return this.bucketStore.get(userId)!;
    }

    const hash = this.simpleHash(userId);
    const bucket: TestBucket = hash % 2 === 0 ? 'A' : 'B';
    this.bucketStore.set(userId, bucket);
    return bucket;
  }

  /**
   * Convenience helper: check whether a user is in a specific bucket.
   */
  isInBucket(userId: string, _experimentKey: string, expected: TestBucket): boolean {
    return this.getBucket(userId) === expected;
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
