/// <reference types="../../backend/node_modules/@types/jest" />

import {
  createDeterministicClock,
  setMockTime,
  advanceTime,
  advanceTimeTo,
  getMockTime,
  getMockTimestamp,
  resetMockTime,
  withMockTime,
} from './time';

describe('Deterministic Time Mocking Utility (Issue #2117)', () => {
  afterEach(() => {
    resetMockTime();
  });

  describe('createDeterministicClock', () => {
    it('initializes with default or specified timestamp', () => {
      const clock = createDeterministicClock('2026-06-01T12:00:00.000Z');
      expect(clock.now().toISOString()).toBe('2026-06-01T12:00:00.000Z');
      expect(clock.timestamp()).toBe(Date.parse('2026-06-01T12:00:00.000Z'));
    });

    it('advances time monotonically', () => {
      const clock = createDeterministicClock('2026-01-01T00:00:00.000Z');
      clock.advance(5000); // +5 seconds
      expect(clock.now().toISOString()).toBe('2026-01-01T00:00:05.000Z');
      clock.advance(60000); // +1 minute
      expect(clock.now().toISOString()).toBe('2026-01-01T00:01:05.000Z');
    });

    it('rejects negative or invalid advance durations', () => {
      const clock = createDeterministicClock();
      expect(() => clock.advance(-1000)).toThrow(
        'Advance duration must be a non-negative finite number'
      );
      expect(() => clock.advance(NaN)).toThrow(
        'Advance duration must be a non-negative finite number'
      );
    });

    it('sets time to new target directly', () => {
      const clock = createDeterministicClock('2026-01-01T00:00:00.000Z');
      clock.setTime('2026-12-31T23:59:59.000Z');
      expect(clock.now().toISOString()).toBe('2026-12-31T23:59:59.000Z');
    });

    it('prevents mutation after restoration', () => {
      const clock = createDeterministicClock();
      clock.restore();
      expect(() => clock.advance(1000)).toThrow('Cannot advance a restored clock');
      expect(() => clock.setTime(1000)).toThrow('Cannot set time on a restored clock');
    });
  });

  describe('global mock time integration', () => {
    it('mocks Date.now() and new Date() consistently', () => {
      const targetIso = '2026-05-15T08:30:00.000Z';
      setMockTime(targetIso);

      expect(new Date().toISOString()).toBe(targetIso);
      expect(Date.now()).toBe(Date.parse(targetIso));
      expect(getMockTime().toISOString()).toBe(targetIso);
      expect(getMockTimestamp()).toBe(Date.parse(targetIso));
    });

    it('allows advancing global mocked time', () => {
      setMockTime('2026-01-01T00:00:00.000Z');
      advanceTime(10000); // +10s

      expect(new Date().toISOString()).toBe('2026-01-01T00:00:10.000Z');
      expect(Date.now()).toBe(Date.parse('2026-01-01T00:00:10.000Z'));
    });

    it('allows advancing global mocked time to a target date', () => {
      setMockTime('2026-01-01T00:00:00.000Z');
      advanceTimeTo('2026-03-01T00:00:00.000Z');

      expect(new Date().toISOString()).toBe('2026-03-01T00:00:00.000Z');
    });

    it('restores real system clock upon resetMockTime()', () => {
      const beforeTs = Date.now();
      setMockTime('1999-01-01T00:00:00.000Z');
      expect(new Date().getFullYear()).toBe(1999);

      resetMockTime();
      expect(new Date().getFullYear()).toBeGreaterThan(2020);
      expect(Date.now()).toBeGreaterThanOrEqual(beforeTs);
    });
  });

  describe('withMockTime scoped helper', () => {
    it('executes callback with mocked time and cleans up automatically', async () => {
      const scopedIso = '2026-07-04T12:00:00.000Z';
      let capturedInScope = '';

      await withMockTime(scopedIso, () => {
        capturedInScope = new Date().toISOString();
        advanceTime(3000);
      });

      expect(capturedInScope).toBe(scopedIso);
      // Cleaned up outside
      expect(new Date().getFullYear()).toBeGreaterThan(2020);
    });

    it('cleans up even if callback throws an error', async () => {
      await expect(
        withMockTime('2026-01-01T00:00:00.000Z', () => {
          throw new Error('Scoped failure');
        })
      ).rejects.toThrow('Scoped failure');

      expect(new Date().getFullYear()).toBeGreaterThan(2020);
    });
  });
});
