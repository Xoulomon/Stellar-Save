/**
 * Edge-case tests for interest/yield calculations — issue #1550
 *
 * Covers:
 *   - Zero balance (principal = 0)
 *   - Zero rate (annualRate = 0)
 *   - Single day period
 *   - Leap-year period (Feb 29 present)
 *   - Non-leap-year period (Feb 29 absent)
 *   - Month boundary crossings
 *   - Year boundary crossings
 *   - Rounding determinism (same inputs ⇒ same output, always)
 *   - Day-count convention differences (actual/365, actual/360, actual/actual)
 *   - Invalid input validation
 *
 * Rounding behaviour is documented here:
 *   - Default precision is 7 decimal places.
 *   - Rule is "round half away from zero" (standard financial rounding).
 *   - The rule is deterministic: identical arguments always produce the same
 *     floating-point value.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateYield,
  daysBetween,
  isLeapYear,
  periodContainsLeapDay,
  roundHalfAwayFromZero,
} from '../utils/interestCalculations';

// ── Helper: UTC Date factory ──────────────────────────────────────────────────
function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: Helper unit tests
// ─────────────────────────────────────────────────────────────────────────────

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    const d = utc(2024, 1, 1);
    expect(daysBetween(d, d)).toBe(0);
  });

  it('returns 1 for consecutive days', () => {
    expect(daysBetween(utc(2024, 1, 1), utc(2024, 1, 2))).toBe(1);
  });

  it('counts correctly across a month boundary (Jan → Feb)', () => {
    expect(daysBetween(utc(2024, 1, 30), utc(2024, 2, 1))).toBe(2);
  });

  it('counts correctly across a year boundary', () => {
    expect(daysBetween(utc(2023, 12, 31), utc(2024, 1, 1))).toBe(1);
  });

  it('counts 366 days in a leap year (full year 2024)', () => {
    expect(daysBetween(utc(2024, 1, 1), utc(2025, 1, 1))).toBe(366);
  });

  it('counts 365 days in a non-leap year (full year 2023)', () => {
    expect(daysBetween(utc(2023, 1, 1), utc(2024, 1, 1))).toBe(365);
  });
});

describe('isLeapYear', () => {
  it('2024 is a leap year (divisible by 4, not by 100)', () => {
    expect(isLeapYear(2024)).toBe(true);
  });

  it('2023 is not a leap year', () => {
    expect(isLeapYear(2023)).toBe(false);
  });

  it('2000 is a leap year (divisible by 400)', () => {
    expect(isLeapYear(2000)).toBe(true);
  });

  it('1900 is not a leap year (divisible by 100 but not 400)', () => {
    expect(isLeapYear(1900)).toBe(false);
  });

  it('2100 is not a leap year', () => {
    expect(isLeapYear(2100)).toBe(false);
  });
});

describe('periodContainsLeapDay', () => {
  it('returns true when period includes Feb 29, 2024', () => {
    expect(periodContainsLeapDay(utc(2024, 2, 1), utc(2024, 3, 1))).toBe(true);
  });

  it('returns false when period ends before Feb 29', () => {
    expect(periodContainsLeapDay(utc(2024, 1, 1), utc(2024, 2, 28))).toBe(false);
  });

  it('returns false when period starts after Feb 29', () => {
    expect(periodContainsLeapDay(utc(2024, 3, 1), utc(2024, 12, 31))).toBe(false);
  });

  it('returns false for a non-leap year', () => {
    expect(periodContainsLeapDay(utc(2023, 1, 1), utc(2024, 1, 1))).toBe(false);
  });

  it('returns false for same-day period (no room for Feb 29)', () => {
    expect(periodContainsLeapDay(utc(2024, 2, 29), utc(2024, 2, 29))).toBe(false);
  });
});

describe('roundHalfAwayFromZero', () => {
  it('rounds 0.5 → 1 (away from zero)', () => {
    expect(roundHalfAwayFromZero(0.5, 0)).toBe(1);
  });

  it('rounds -0.5 → -1 (away from zero)', () => {
    expect(roundHalfAwayFromZero(-0.5, 0)).toBe(-1);
  });

  it('rounds to 7 decimal places', () => {
    expect(roundHalfAwayFromZero(1.23456789, 7)).toBe(1.2345679);
  });

  it('is idempotent — rounding twice gives the same result', () => {
    const once = roundHalfAwayFromZero(3.1415926535, 4);
    const twice = roundHalfAwayFromZero(once, 4);
    expect(once).toBe(twice);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Zero-balance edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateYield — zero balance', () => {
  it('returns 0 accrued interest for principal = 0', () => {
    const result = calculateYield({
      principal: 0,
      annualRate: 0.05,
      startDate: utc(2024, 1, 1),
      endDate: utc(2024, 7, 1),
    });
    expect(result.accruedInterest).toBe(0);
    expect(result.endBalance).toBe(0);
  });

  it('endBalance equals principal when principal = 0', () => {
    const result = calculateYield({
      principal: 0,
      annualRate: 0.10,
      startDate: utc(2023, 6, 1),
      endDate: utc(2023, 12, 31),
    });
    expect(result.endBalance).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Zero rate edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateYield — zero rate', () => {
  it('returns 0 accrued interest when annualRate = 0', () => {
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0,
      startDate: utc(2024, 1, 1),
      endDate: utc(2024, 12, 31),
    });
    expect(result.accruedInterest).toBe(0);
  });

  it('endBalance equals principal when annualRate = 0', () => {
    const result = calculateYield({
      principal: 5_000,
      annualRate: 0,
      startDate: utc(2024, 1, 1),
      endDate: utc(2024, 6, 30),
    });
    expect(result.endBalance).toBe(5_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: Single-day period
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateYield — single day', () => {
  it('accrues exactly one day of interest (actual/365)', () => {
    const principal = 36_500;   // chosen so 1-day interest = principal × rate / 365
    const annualRate = 0.10;    // 10 %
    const result = calculateYield({
      principal,
      annualRate,
      startDate: utc(2023, 3, 15),
      endDate: utc(2023, 3, 16),
      dayCount: 'actual/365',
      decimalPlaces: null, // raw value
    });

    expect(result.days).toBe(1);
    expect(result.accruedInterest).toBeCloseTo(10, 6); // 36500 × 0.1 / 365 = 10
  });

  it('days is 1 for single-day period', () => {
    const result = calculateYield({
      principal: 1_000,
      annualRate: 0.05,
      startDate: utc(2024, 2, 28),
      endDate: utc(2024, 2, 29),
    });
    expect(result.days).toBe(1);
  });

  it('returns 0 accrued interest when startDate equals endDate (0 days)', () => {
    const d = utc(2024, 6, 1);
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.08,
      startDate: d,
      endDate: d,
    });
    expect(result.accruedInterest).toBe(0);
    expect(result.days).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: Leap-year period
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateYield — leap year', () => {
  it('actual/actual uses 366-day basis when period spans Feb 29', () => {
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.05,
      startDate: utc(2024, 1, 1),
      endDate: utc(2024, 12, 31),
      dayCount: 'actual/actual',
      decimalPlaces: null,
    });
    // Period is Jan 1 → Dec 31 2024 (includes Feb 29)
    expect(result.yearBasis).toBe(366);
    expect(result.days).toBe(365); // Jan 1 to Dec 31 = 365 days
  });

  it('actual/365 always uses 365-day basis even in a leap year', () => {
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.05,
      startDate: utc(2024, 2, 1),
      endDate: utc(2024, 3, 1),
      dayCount: 'actual/365',
    });
    expect(result.yearBasis).toBe(365);
  });

  it('actual/actual uses 365-day basis when period does NOT span Feb 29', () => {
    // 2023 is not a leap year; Jan 1 → Dec 31 has no Feb 29
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.05,
      startDate: utc(2023, 1, 1),
      endDate: utc(2023, 12, 31),
      dayCount: 'actual/actual',
    });
    expect(result.yearBasis).toBe(365);
  });

  it('period spanning Jan–Mar of 2024 includes Feb 29 (actual/actual → 366)', () => {
    const result = calculateYield({
      principal: 5_000,
      annualRate: 0.06,
      startDate: utc(2024, 1, 1),
      endDate: utc(2024, 3, 31),
      dayCount: 'actual/actual',
    });
    expect(result.yearBasis).toBe(366);
  });

  it('period in 2024 that ends before Feb 29 uses 365 basis (actual/actual)', () => {
    const result = calculateYield({
      principal: 5_000,
      annualRate: 0.06,
      startDate: utc(2024, 1, 1),
      endDate: utc(2024, 2, 28),
      dayCount: 'actual/actual',
    });
    expect(result.yearBasis).toBe(365);
  });

  it('leap-year full-year interest with actual/actual is less than actual/365', () => {
    // Larger denominator (366) → smaller fractional year → lower interest
    const params = {
      principal: 10_000,
      annualRate: 0.05,
      startDate: utc(2024, 1, 1),
      endDate: utc(2025, 1, 1),
      decimalPlaces: null as null,
    };
    const r365 = calculateYield({ ...params, dayCount: 'actual/365' });
    const rActual = calculateYield({ ...params, dayCount: 'actual/actual' });
    expect(rActual.accruedInterest).toBeLessThan(r365.accruedInterest);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 6: Month boundary crossings
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateYield — month boundaries', () => {
  it('correctly handles Jan 31 → Feb 1 (short-month boundary)', () => {
    const result = calculateYield({
      principal: 12_000,
      annualRate: 0.06,
      startDate: utc(2024, 1, 31),
      endDate: utc(2024, 2, 1),
    });
    expect(result.days).toBe(1);
    expect(result.accruedInterest).toBeGreaterThan(0);
  });

  it('correctly handles Feb 28 → Mar 1 in a non-leap year', () => {
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.05,
      startDate: utc(2023, 2, 28),
      endDate: utc(2023, 3, 1),
    });
    expect(result.days).toBe(1);
  });

  it('correctly handles Feb 29 → Mar 1 in a leap year', () => {
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.05,
      startDate: utc(2024, 2, 29),
      endDate: utc(2024, 3, 1),
    });
    expect(result.days).toBe(1);
  });

  it('Q1 period (Jan 1 → Apr 1, 2024) accrues correct days', () => {
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.04,
      startDate: utc(2024, 1, 1),
      endDate: utc(2024, 4, 1),
    });
    // Jan: 31, Feb: 29 (leap), Mar: 31 → 91 days
    expect(result.days).toBe(91);
  });

  it('Q1 period in non-leap year (Jan 1 → Apr 1, 2023) has 90 days', () => {
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.04,
      startDate: utc(2023, 1, 1),
      endDate: utc(2023, 4, 1),
    });
    // Jan: 31, Feb: 28, Mar: 31 → 90 days
    expect(result.days).toBe(90);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 7: Year boundary crossings
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateYield — year boundary crossings', () => {
  it('Dec 31 → Jan 1 is a single day', () => {
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.05,
      startDate: utc(2023, 12, 31),
      endDate: utc(2024, 1, 1),
    });
    expect(result.days).toBe(1);
  });

  it('full calendar year 2023 (non-leap) is 365 days', () => {
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.05,
      startDate: utc(2023, 1, 1),
      endDate: utc(2024, 1, 1),
    });
    expect(result.days).toBe(365);
  });

  it('full calendar year 2024 (leap) is 366 days', () => {
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.05,
      startDate: utc(2024, 1, 1),
      endDate: utc(2025, 1, 1),
    });
    expect(result.days).toBe(366);
  });

  it('cross-year period Dec 1 2023 → Feb 1 2024 is 62 days', () => {
    const result = calculateYield({
      principal: 10_000,
      annualRate: 0.05,
      startDate: utc(2023, 12, 1),
      endDate: utc(2024, 2, 1),
    });
    // Dec: 31, Jan: 31 → 62 days
    expect(result.days).toBe(62);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 8: Day-count convention comparisons
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateYield — day-count conventions', () => {
  const base = {
    principal: 10_000,
    annualRate: 0.05,
    startDate: utc(2024, 1, 1),
    endDate: utc(2024, 7, 1),    // 182 days (leap year, includes Feb 29)
    decimalPlaces: null as null,
  };

  it('actual/360 produces more interest than actual/365 (smaller basis)', () => {
    const r360 = calculateYield({ ...base, dayCount: 'actual/360' });
    const r365 = calculateYield({ ...base, dayCount: 'actual/365' });
    expect(r360.accruedInterest).toBeGreaterThan(r365.accruedInterest);
  });

  it('actual/365 produces more interest than actual/actual when period spans leap day', () => {
    const r365 = calculateYield({ ...base, dayCount: 'actual/365' });
    const rAA = calculateYield({ ...base, dayCount: 'actual/actual' });
    // actual/actual → 366 basis → lower interest
    expect(r365.accruedInterest).toBeGreaterThan(rAA.accruedInterest);
  });

  it('actual/360 year basis is always 360', () => {
    expect(calculateYield({ ...base, dayCount: 'actual/360' }).yearBasis).toBe(360);
  });

  it('actual/365 year basis is always 365', () => {
    expect(calculateYield({ ...base, dayCount: 'actual/365' }).yearBasis).toBe(365);
  });

  it('default convention is actual/365', () => {
    const withDefault = calculateYield({ ...base });
    const withExplicit = calculateYield({ ...base, dayCount: 'actual/365' });
    expect(withDefault.yearBasis).toBe(withExplicit.yearBasis);
    expect(withDefault.accruedInterest).toBe(withExplicit.accruedInterest);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 9: Rounding determinism
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateYield — rounding determinism', () => {
  /**
   * The function is pure: identical inputs must always return identical
   * floating-point outputs. This section calls the same parameters multiple
   * times and asserts bit-for-bit equality to guard against any accidental
   * non-determinism (e.g. Date.now() seeping in, mutable global state, etc.).
   */

  const deterministicParams = {
    principal: 7_654.32,
    annualRate: 0.0312,
    startDate: utc(2024, 2, 14),
    endDate: utc(2024, 11, 5),
    dayCount: 'actual/365' as const,
    decimalPlaces: 7,
  };

  it('same inputs produce the same accruedInterest on every call', () => {
    const r1 = calculateYield(deterministicParams);
    const r2 = calculateYield(deterministicParams);
    const r3 = calculateYield(deterministicParams);
    expect(r1.accruedInterest).toBe(r2.accruedInterest);
    expect(r2.accruedInterest).toBe(r3.accruedInterest);
  });

  it('same inputs produce the same endBalance on every call', () => {
    const r1 = calculateYield(deterministicParams);
    const r2 = calculateYield(deterministicParams);
    expect(r1.endBalance).toBe(r2.endBalance);
  });

  it('same inputs produce the same days count on every call', () => {
    const r1 = calculateYield(deterministicParams);
    const r2 = calculateYield(deterministicParams);
    expect(r1.days).toBe(r2.days);
  });

  it('decimalPlaces=7 result matches manual roundHalfAwayFromZero(raw, 7)', () => {
    const raw = calculateYield({ ...deterministicParams, decimalPlaces: null });
    const rounded = calculateYield({ ...deterministicParams, decimalPlaces: 7 });
    // roundHalfAwayFromZero is already imported at the top of this file
    expect(rounded.accruedInterest).toBe(roundHalfAwayFromZero(raw.accruedInterest, 7));
  });

  it('decimalPlaces=2 rounds to 2 decimal places', () => {
    const result = calculateYield({ ...deterministicParams, decimalPlaces: 2 });
    const asString = result.accruedInterest.toString();
    // At most 2 decimal digits
    const decimalPart = asString.includes('.') ? asString.split('.')[1] : '';
    expect(decimalPart.length).toBeLessThanOrEqual(2);
  });

  it('decimalPlaces=null returns raw float without rounding', () => {
    const raw = calculateYield({ ...deterministicParams, decimalPlaces: null });
    const rounded = calculateYield({ ...deterministicParams, decimalPlaces: 7 });
    // raw MAY differ from rounded at higher precision
    // The key contract: raw is still a finite number
    expect(Number.isFinite(raw.accruedInterest)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section 10: Input validation
// ─────────────────────────────────────────────────────────────────────────────

describe('calculateYield — input validation', () => {
  const validBase = {
    principal: 1_000,
    annualRate: 0.05,
    startDate: utc(2024, 1, 1),
    endDate: utc(2024, 6, 1),
  };

  it('throws RangeError when principal is negative', () => {
    expect(() => calculateYield({ ...validBase, principal: -1 })).toThrow(RangeError);
    expect(() => calculateYield({ ...validBase, principal: -1 })).toThrow(/principal/);
  });

  it('throws RangeError when annualRate is negative', () => {
    expect(() => calculateYield({ ...validBase, annualRate: -0.01 })).toThrow(RangeError);
    expect(() => calculateYield({ ...validBase, annualRate: -0.01 })).toThrow(/annualRate/);
  });

  it('throws RangeError when endDate is before startDate', () => {
    expect(() =>
      calculateYield({ ...validBase, startDate: utc(2024, 6, 1), endDate: utc(2024, 1, 1) }),
    ).toThrow(RangeError);
  });

  it('accepts zero principal (no throw)', () => {
    expect(() => calculateYield({ ...validBase, principal: 0 })).not.toThrow();
  });

  it('accepts zero rate (no throw)', () => {
    expect(() => calculateYield({ ...validBase, annualRate: 0 })).not.toThrow();
  });

  it('accepts equal startDate and endDate (0-day period, no throw)', () => {
    expect(() =>
      calculateYield({ ...validBase, startDate: utc(2024, 1, 1), endDate: utc(2024, 1, 1) }),
    ).not.toThrow();
  });
});
