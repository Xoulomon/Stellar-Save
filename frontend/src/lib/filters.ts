/**
 * filters.ts — reusable group-list filtering predicates.
 *
 * Centralises all filter logic that was previously inlined in GroupList.tsx
 * (and duplicated in BrowseGroupsPage.tsx / SearchBar consumers) into a single
 * location so every consumer shares the same behaviour.
 *
 * Design choices:
 * - Pure functions (no side-effects, no React imports) — easy to unit-test.
 * - Each predicate accepts a single group record and returns a boolean so they
 *   compose cleanly with `Array.prototype.filter`.
 * - The top-level `applyGroupFilters` function applies all predicates in one
 *   pass to avoid multiple array allocations.
 */

/** Minimal shape required by every filter predicate. */
export interface FilterableGroup {
  name: string;
  description?: string;
  currency?: string;
  contributionAmount?: number;
}

/** Parameters accepted by `applyGroupFilters`. */
export interface GroupFilterParams {
  /** Free-text search — matches name or description (case-insensitive, trimmed). */
  searchQuery?: string;
  /** Exact currency match, e.g. "XLM" or "USDC" (case-insensitive, trimmed). */
  currencyFilter?: string;
  /** Minimum contribution amount (inclusive). Empty string means no lower bound. */
  minAmount?: string;
  /** Maximum contribution amount (inclusive). Empty string means no upper bound. */
  maxAmount?: string;
}

// ─── Individual predicates ────────────────────────────────────────────────────

/**
 * Returns `true` when the group name or description contains `query`.
 * An empty / whitespace-only query always matches.
 */
export function matchesSearchQuery<G extends FilterableGroup>(
  group: G,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    group.name.toLowerCase().includes(q) ||
    (group.description?.toLowerCase().includes(q) ?? false)
  );
}

/**
 * Returns `true` when the group's currency matches `filter`.
 * An empty / whitespace-only filter always matches.
 * Comparison is case-insensitive.
 */
export function matchesCurrency<G extends FilterableGroup>(
  group: G,
  filter: string,
): boolean {
  const f = filter.trim().toLowerCase();
  if (!f) return true;
  return (group.currency?.toLowerCase() ?? '') === f;
}

/**
 * Returns `true` when the group's contribution amount is ≥ `min`.
 * `min` is parsed as a number; if it is not a valid finite number the predicate
 * always returns `true` (no lower bound).
 */
export function matchesMinAmount<G extends FilterableGroup>(
  group: G,
  min: string,
): boolean {
  if (min.trim() === '') return true;
  const minVal = Number(min);
  if (!Number.isFinite(minVal)) return true;
  return (group.contributionAmount ?? 0) >= minVal;
}

/**
 * Returns `true` when the group's contribution amount is ≤ `max`.
 * `max` is parsed as a number; if it is not a valid finite number the predicate
 * always returns `true` (no upper bound).
 */
export function matchesMaxAmount<G extends FilterableGroup>(
  group: G,
  max: string,
): boolean {
  if (max.trim() === '') return true;
  const maxVal = Number(max);
  if (!Number.isFinite(maxVal)) return true;
  return (group.contributionAmount ?? 0) <= maxVal;
}

// ─── Composite helper ─────────────────────────────────────────────────────────

/**
 * Applies all active filter predicates to `groups` in a single pass.
 *
 * @example
 * const visible = applyGroupFilters(allGroups, {
 *   searchQuery: 'alpha',
 *   currencyFilter: 'XLM',
 *   minAmount: '100',
 *   maxAmount: '500',
 * });
 */
export function applyGroupFilters<G extends FilterableGroup>(
  groups: G[],
  params: GroupFilterParams,
): G[] {
  const {
    searchQuery = '',
    currencyFilter = '',
    minAmount = '',
    maxAmount = '',
  } = params;

  return groups.filter(
    (g) =>
      matchesSearchQuery(g, searchQuery) &&
      matchesCurrency(g, currencyFilter) &&
      matchesMinAmount(g, minAmount) &&
      matchesMaxAmount(g, maxAmount),
  );
}
