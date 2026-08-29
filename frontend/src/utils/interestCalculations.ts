/**
 * Interest and yield calculation utilities for Stellar Save.
 *
 * These functions compute accrued interest / yield on a principal balance
 * over a time period using a simple-interest model (P × r × t), where
 * `t` is expressed in fractional years.
 *
 * Design notes
 * ────────────
 * • All monetary values are represented as JavaScript `number` (64-bit float).
 *   Callers that need stricter precision should use the returned raw value and
 *   round externally with a deterministic method (e.g. Math.round at 7 d.p.).
 * • The number of days in a year is configurable so callers can choose between
 *   the Actual/365, Actual/360, or Actual/Actual (leap-year-aware) conventions.
 * • The function is pure and referentially transparent — the same inputs
 *   always produce the same output, making it safe to test for rounding
 *   determinism.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Day-count convention used when converting a day count to a fractional year.
 *
 * - `"actual/365"` — always divides by 365 (most common for crypto)
 * - `"actual/360"` — always divides by 360 (money-market convention)
 * - `"actual/actual"` — divides by 366 if the period contains Feb 29,
 *                       otherwise 365
 */
export type DayCountConvention = 'actual/365' | 'actual/360' | 'actual/actual';

/** Parameters accepted by {@link calculateYield}. */
export interface YieldParams {
  /** Principal balance (must be ≥ 0). */
  principal: number;
  /**
   * Annual interest rate as a decimal fraction (e.g. 0.05 for 5 %).
   * Must be ≥ 0.
   */
  annualRate: number;
  /** Start of the accrual period (inclusive). */
  startDate: Date;
  /** End of the accrual period (inclusive). */
  endDate: Date;
  /**
   * Day-count convention (default: `"actual/365"`).
   * Documented so callers can reason about leap-year behaviour.
   */
  dayCount?: DayCountConvention;
  /**
   * Number of decimal places to round the result to (default: 7).
   * Pass `null` to skip rounding and return the raw floating-point value.
   */
  decimalPlaces?: number | null;
}

/** Result returned by {@link calculateYield}. */
export interface YieldResult {
  /** Accrued interest for the period (always ≥ 0). */
  accruedInterest: number;
  /** End balance: principal + accruedInterest. */
  endBalance: number;
  /** Number of calendar days in the period (endDate − startDate). */
  days: number;
  /** Fractional year used in the calculation (days / yearBasis). */
  fractionalYear: number;
  /** The year basis (360, 365, or 366) used for this calculation. */
  yearBasis: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the number of calendar days between two dates.
 * Fractional millisecond differences are truncated.
 */
export function daysBetween(start: Date, end: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.trunc((end.getTime() - start.getTime()) / msPerDay);
}

/**
 * Returns true if a given year is a leap year (Gregorian calendar).
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns true if the date range [start, end) spans February 29 of any year.
 * Used to select 366-day basis under the `"actual/actual"` convention.
 */
export function periodContainsLeapDay(start: Date, end: Date): boolean {
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  for (let y = startYear; y <= endYear; y++) {
    if (!isLeapYear(y)) continue;
    const feb29 = new Date(Date.UTC(y, 1, 29)); // month is 0-indexed
    if (feb29 >= start && feb29 < end) return true;
  }
  return false;
}

/**
 * Resolves the year basis (denominator) for a given convention and period.
 */
function resolveYearBasis(
  convention: DayCountConvention,
  start: Date,
  end: Date,
): number {
  switch (convention) {
    case 'actual/360':
      return 360;
    case 'actual/actual':
      return periodContainsLeapDay(start, end) ? 366 : 365;
    case 'actual/365':
    default:
      return 365;
  }
}

/**
 * Round `value` to `places` decimal places using the "round half away from
 * zero" rule — the same rule used by most financial systems.
 *
 * JS `Math.round` rounds -0.5 to 0 (towards +∞), so we implement the
 * correct financial rounding explicitly: Math.sign × Math.round(|x|).
 *
 * This is deterministic: given the same inputs the output is always identical.
 */
export function roundHalfAwayFromZero(value: number, places: number): number {
  const factor = Math.pow(10, places);
  return (Math.sign(value) || 1) * Math.round(Math.abs(value) * factor) / factor;
}

// ── Core function ─────────────────────────────────────────────────────────────

/**
 * Calculate simple-interest yield for a principal over a date range.
 *
 * Formula:  interest = principal × annualRate × (days / yearBasis)
 *
 * @throws {RangeError} if principal < 0, annualRate < 0, or endDate < startDate.
 *
 * @example
 * calculateYield({
 *   principal: 10_000,
 *   annualRate: 0.05,
 *   startDate: new Date('2024-01-01'),
 *   endDate:   new Date('2024-04-01'),
 * });
 * // → { accruedInterest: ~123.29, endBalance: ~10123.29, days: 91, ... }
 */
export function calculateYield(params: YieldParams): YieldResult {
  const {
    principal,
    annualRate,
    startDate,
    endDate,
    dayCount = 'actual/365',
    decimalPlaces = 7,
  } = params;

  // ── Validation ──────────────────────────────────────────────────────────
  if (principal < 0) {
    throw new RangeError(`principal must be ≥ 0, got ${principal}`);
  }
  if (annualRate < 0) {
    throw new RangeError(`annualRate must be ≥ 0, got ${annualRate}`);
  }
  const days = daysBetween(startDate, endDate);
  if (days < 0) {
    throw new RangeError(
      `endDate must be ≥ startDate (got ${days} days)`,
    );
  }

  // ── Calculation ─────────────────────────────────────────────────────────
  const yearBasis = resolveYearBasis(dayCount, startDate, endDate);
  const fractionalYear = days / yearBasis;
  const rawInterest = principal * annualRate * fractionalYear;

  const accruedInterest =
    decimalPlaces != null
      ? roundHalfAwayFromZero(rawInterest, decimalPlaces)
      : rawInterest;

  const endBalance =
    decimalPlaces != null
      ? roundHalfAwayFromZero(principal + rawInterest, decimalPlaces)
      : principal + rawInterest;

  return {
    accruedInterest,
    endBalance,
    days,
    fractionalYear,
    yearBasis,
  };
}
