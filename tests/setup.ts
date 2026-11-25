import '@testing-library/jest-dom';

/**
 * Quarantine support for flaky tests (see issue #2106).
 *
 * Flaky tests are skipped by default so CI stays green. To run them locally
 * (e.g. while investigating a fix), set the environment variable:
 *
 *   RUN_QUARANTINED_TESTS=1 npm test
 *
 * Usage in a test file:
 *
 *   import { describeQuarantined, itQuarantined } from '../setup';
 *
 *   describeQuarantined('flaky suite', () => {
 *     itQuarantined('flaky case', () => { ... });
 *   });
 */

export const isQuarantineEnabled = (): boolean =>
  process.env.RUN_QUARANTINED_TESTS === '1' ||
  process.env.RUN_QUARANTINED_TESTS === 'true';

const quarantineReason = (reason?: string): string =>
  reason ? `[quarantined] ${reason}` : '[quarantined] flaky test';

/**
 * `describe` wrapper that skips the whole block unless quarantined tests are
 * explicitly enabled. Falls back to a plain `describe` when enabled so the
 * suite runs unchanged.
 */
export const describeQuarantined: typeof describe = ((name: string, fn: () => void) => {
  if (isQuarantineEnabled()) {
    return describe(name, fn);
  }
  return describe.skip(quarantineReason(name), fn);
}) as typeof describe;

/**
 * `it`/`test` wrapper that skips a single flaky case unless quarantined tests
 * are explicitly enabled.
 */
export const itQuarantined: typeof it = ((name: string, fn?: () => void, timeout?: number) => {
  if (isQuarantineEnabled()) {
    return it(name, fn, timeout);
  }
  return it.skip(quarantineReason(name), fn, timeout);
}) as typeof it;

export const testQuarantined: typeof test = itQuarantined as typeof test;
