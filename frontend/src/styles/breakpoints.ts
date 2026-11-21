/**
 * Centralized responsive breakpoint definitions for the frontend.
 *
 * Single source of truth for mobile-first breakpoints so that media queries,
 * JS consumers and tests all agree on the same boundaries.
 */

export const breakpoints = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * Build a mobile-first `min-width` media query for the given breakpoint.
 * `xs` resolves to `0` and therefore matches all viewports.
 */
export function up(breakpoint: Breakpoint): string {
  return `@media (min-width: ${breakpoints[breakpoint]}px)`;
}

/**
 * Build a `max-width` media query that targets viewports strictly below the
 * given breakpoint. `xs` has no lower bound, so it yields an empty query.
 */
export function down(breakpoint: Breakpoint): string {
  const value = breakpoints[breakpoint];
  if (value === 0) {
    return '';
  }
  return `@media (max-width: ${value - 0.02}px)`;
}

/**
 * Build a media query constrained to a single breakpoint range.
 */
export function between(min: Breakpoint, max: Breakpoint): string {
  const minValue = breakpoints[min];
  const maxValue = breakpoints[max];
  if (maxValue <= minValue) {
    throw new Error(
      `Invalid breakpoint range: "${min}" (${minValue}px) must be below "${max}" (${maxValue}px)`,
    );
  }
  return `@media (min-width: ${minValue}px) and (max-width: ${maxValue - 0.02}px)`;
}

/**
 * Convenience predicate for JS consumers that need to know whether a viewport
 * width falls within a given breakpoint's mobile-first range.
 */
export function matches(breakpoint: Breakpoint, width: number): boolean {
  const keys = Object.keys(breakpoints) as Breakpoint[];
  const index = keys.indexOf(breakpoint);
  const min = breakpoints[breakpoint];
  const next = keys[index + 1];
  const max = next ? breakpoints[next] : Infinity;
  return width >= min && width < max;
}
