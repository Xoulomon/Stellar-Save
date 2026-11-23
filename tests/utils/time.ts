/**
 * Deterministic time mocking utility for tests (Issue #2117).
 *
 * Provides a robust, leak-free clock control abstraction for deterministic
 * timestamp and interval testing across unit, integration, and E2E suites.
 */

export interface MockClock {
  /** Get current mocked Date */
  now(): Date;
  /** Get current mocked timestamp (ms since epoch) */
  timestamp(): number;
  /** Advance time by positive milliseconds */
  advance(ms: number): void;
  /** Set time to a specific target */
  setTime(target: string | number | Date): void;
  /** Restore real system clock */
  restore(): void;
}

let activeClock: MockClock | null = null;
let originalDateNow: (() => number) | null = null;
let originalDate: DateConstructor | null = null;

function normalizeToTimestamp(time: string | number | Date): number {
  if (typeof time === 'number') {
    if (!Number.isFinite(time)) throw new Error('Invalid timestamp number');
    return time;
  }
  const date = new Date(time);
  const ts = date.getTime();
  if (Number.isNaN(ts)) {
    throw new Error(`Invalid date/time value: ${String(time)}`);
  }
  return ts;
}

/**
 * Creates an isolated, deterministic clock controller.
 */
export function createDeterministicClock(
  initialTime: string | number | Date = '2026-01-01T00:00:00.000Z'
): MockClock {
  let currentTimestamp = normalizeToTimestamp(initialTime);
  let isRestored = false;

  const clock: MockClock = {
    now() {
      return new Date(currentTimestamp);
    },
    timestamp() {
      return currentTimestamp;
    },
    advance(ms: number) {
      if (isRestored) throw new Error('Cannot advance a restored clock');
      if (typeof ms !== 'number' || ms < 0 || !Number.isFinite(ms)) {
        throw new Error('Advance duration must be a non-negative finite number');
      }
      currentTimestamp += ms;
    },
    setTime(target: string | number | Date) {
      if (isRestored) throw new Error('Cannot set time on a restored clock');
      currentTimestamp = normalizeToTimestamp(target);
    },
    restore() {
      isRestored = true;
    },
  };

  return clock;
}

/**
 * Freeze global Date to a deterministic timestamp.
 */
export function setMockTime(time: string | number | Date = '2026-01-01T00:00:00.000Z'): MockClock {
  if (activeClock) {
    activeClock.restore();
  }

  const clock = createDeterministicClock(time);
  activeClock = clock;

  if (!originalDateNow) {
    originalDateNow = global.Date.now;
  }
  if (!originalDate) {
    originalDate = global.Date;
  }

  const OriginalDate = originalDate;
  // Proxy Date constructor
  const MockedDate: any = function (...args: any[]) {
    if (new.target) {
      if (args.length === 0) {
        return clock.now();
      }
      // @ts-expect-error construct original date
      return new OriginalDate(...args);
    }
    if (args.length === 0) {
      return clock.now().toString();
    }
    // @ts-expect-error construct original date string
    return OriginalDate(...args);
  };

  MockedDate.prototype = OriginalDate.prototype;
  MockedDate.now = () => clock.timestamp();
  MockedDate.parse = OriginalDate.parse;
  MockedDate.UTC = OriginalDate.UTC;

  global.Date = MockedDate as DateConstructor;

  return clock;
}

/**
 * Advance active mock clock by `ms` milliseconds.
 */
export function advanceTime(ms: number): void {
  if (!activeClock) {
    throw new Error('No active mock clock. Call setMockTime() first.');
  }
  activeClock.advance(ms);
}

/**
 * Advance active mock clock to a target timestamp.
 */
export function advanceTimeTo(target: string | number | Date): void {
  if (!activeClock) {
    throw new Error('No active mock clock. Call setMockTime() first.');
  }
  activeClock.setTime(target);
}

/**
 * Get current mock Date from active clock.
 */
export function getMockTime(): Date {
  if (!activeClock) {
    return new Date();
  }
  return activeClock.now();
}

/**
 * Get current mock timestamp in ms from active clock.
 */
export function getMockTimestamp(): number {
  if (!activeClock) {
    return Date.now();
  }
  return activeClock.timestamp();
}

/**
 * Restore original global Date implementation.
 */
export function resetMockTime(): void {
  if (activeClock) {
    activeClock.restore();
    activeClock = null;
  }
  if (originalDate) {
    global.Date = originalDate;
    if (originalDateNow) {
      global.Date.now = originalDateNow;
      originalDateNow = null;
    }
    originalDate = null;
  }
}

export const restoreTime = resetMockTime;

/**
 * Run a scoped callback with deterministic mock time, safely resetting afterwards.
 */
export async function withMockTime<T>(
  time: string | number | Date,
  fn: () => T | Promise<T>
): Promise<T> {
  setMockTime(time);
  try {
    return await fn();
  } finally {
    resetMockTime();
  }
}
