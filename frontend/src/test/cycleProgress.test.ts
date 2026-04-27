import { describe, it, expect, vi } from 'vitest';
import { 
  calculateCycleProgress, 
  calculateCycleProgressFromDeadline,
  type CycleProgressResult 
} from '../utils/cycleProgress';

// Mock Date for consistent testing
const FIXED_NOW = new Date('2024-01-15T12:00:00Z');
vi.useFakeTimers().setSystemTime(FIXED_NOW);

describe('calculateCycleProgress', () => {
  describe('time progress', () => {
    it('returns 0% for unstarted cycle', () => {
      const result = calculateCycleProgress({
        cycleStart: null,
        cycleDurationSeconds: 3600,
        contributedCount: 0,
        totalMembers: 5
      });
      
      expect(result.timeProgress).toBe(0);
      expect(result.contributionProgress).toBe(0);
      expect(result.timeRemaining).toBeNull();
    });

    it('calculates correct time progress mid-cycle', () => {
      const result = calculateCycleProgress({
        cycleStart: new Date(Date.now() - 1800 * 1000), // halfway through 1hr
        cycleDurationSeconds: 3600,
        contributedCount: 0,
        totalMembers: 5
      });
      
      expect(result.timeProgress).toBeCloseTo(50);
      expect(result.isOverdue).toBe(false);
    });

    it('returns 100% time progress for overdue cycle', () => {
      const result = calculateCycleProgress({
        cycleStart: new Date(Date.now() - 7200 * 1000), // past 2hrs, duration 1hr
        cycleDurationSeconds: 3600,
        contributedCount: 0,
        totalMembers: 5
      });
      
      expect(result.timeProgress).toBe(100);
      expect(result.isOverdue).toBe(true);
    });
  });

  describe('contribution progress', () => {
    it('calculates partial contributions correctly', () => {
      const result = calculateCycleProgress({
        cycleStart: new Date(),
        cycleDurationSeconds: 3600,
        contributedCount: 3,
        totalMembers: 5
      });
      
      expect(result.contributionProgress).toBe(60);
    });

    it('caps contributions at 100%', () => {
      const result = calculateCycleProgress({
        cycleStart: new Date(),
        cycleDurationSeconds: 3600,
        contributedCount: 10,
        totalMembers: 5
      });
      
      expect(result.contributionProgress).toBe(100);
    });

    it('returns 0% for no contributions', () => {
      const result = calculateCycleProgress({
        cycleStart: new Date(),
        cycleDurationSeconds: 3600,
        contributedCount: 0,
        totalMembers: 5
      });
      
      expect(result.contributionProgress).toBe(0);
    });
  });

  describe('overall progress and completion', () => {
    it('overall is min(time, contribution)', () => {
      const result = calculateCycleProgress({
        cycleStart: new Date(Date.now() - 1800 * 1000), // 50% time
        cycleDurationSeconds: 3600,
        contributedCount: 4,
        totalMembers: 5 // 80% contrib
      });
      
      expect(result.overallProgress).toBeCloseTo(50); // min(50, 80)
    });

    it('marks complete only when both 100%', () => {
      const complete = calculateCycleProgress({
        cycleStart: new Date(Date.now() - 7200 * 1000),
        cycleDurationSeconds: 3600,
        contributedCount: 5,
        totalMembers: 5
      });
      
      expect(complete.isComplete).toBe(true);
      expect(complete.overallProgress).toBe(100);
      
      const incompleteTime = calculateCycleProgress({
        cycleStart: new Date(Date.now() - 1800 * 1000),
        cycleDurationSeconds: 3600,
        contributedCount: 5,
        totalMembers: 5
      });
      
      expect(incompleteTime.isComplete).toBe(false);
    });
  });

  describe('time remaining formatting', () => {
    it('formats multi-day remaining', () => {
      const cycleStart = new Date(FIXED_NOW.getTime() - (24 * 60 * 60 * 1000 * 25)); // 25 days ago
      const result = calculateCycleProgress({
        cycleStart,
        cycleDurationSeconds: 30 * 24 * 60 * 60,
        contributedCount: 0,
        totalMembers: 1
      });
      
      expect(result.timeRemaining).toBe('5d 0h'); // 5 days remaining
    });

    it('formats hours and minutes', () => {
      const cycleStart = new Date(FIXED_NOW.getTime() - (47 * 60 * 60 * 1000)); // 47hrs ago
      const result = calculateCycleProgress({
        cycleStart,
        cycleDurationSeconds: 72 * 60 * 60, // 3 days
        contributedCount: 0,
        totalMembers: 1
      });
      
      expect(result.timeRemaining).toBe('1d 1h'); // 25 hours remaining
    });

    it('null for overdue', () => {
      const result = calculateCycleProgress({
        cycleStart: new Date(FIXED_NOW.getTime() - 3700 * 1000),
        cycleDurationSeconds: 3600,
        contributedCount: 0,
        totalMembers: 1
      });
      
      expect(result.timeRemaining).toBeNull();
    });
  });

  describe('edge cases and validation', () => {
    it('throws on invalid duration', () => {
      expect(() => calculateCycleProgress({
        cycleStart: new Date(),
        cycleDurationSeconds: 0,
        contributedCount: 0,
        totalMembers: 1
      })).toThrow('Cycle duration must be greater than 0');
    });

    it('throws on zero members', () => {
      expect(() => calculateCycleProgress({
        cycleStart: new Date(),
        cycleDurationSeconds: 3600,
        contributedCount: 0,
        totalMembers: 0
      })).toThrow('Total members must be greater than 0');
    });

    it('clamps negative values', () => {
      const result = calculateCycleProgress({
        cycleStart: new Date(Date.now() + 1000),
        cycleDurationSeconds: 3600,
        contributedCount: -1,
        totalMembers: 5
      });
      
      expect(result.timeProgress).toBe(0);
      expect(result.contributionProgress).toBe(0);
    });
  });
});

describe('calculateCycleProgressFromDeadline', () => {
  it('calculates using 30-day cycle assumption', () => {
    const deadline = new Date(FIXED_NOW.getTime() + (15 * 24 * 60 * 60 * 1000)); // 15 days from now
    const result = calculateCycleProgressFromDeadline(deadline, 3, 5);
    
    expect(result.timeProgress).toBeCloseTo(50);
    expect(result.contributionProgress).toBe(60);
  });
});
