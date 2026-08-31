/**
 * Shared pagination utility for list endpoints.
 *
 * Supports two modes:
 *   - Offset/limit: classic page-oriented style  (?limit=20&offset=40)
 *   - Cursor:       opaque-token style            (?cursor=<token>&limit=20)
 *
 * The caller is responsible for fetching the data slice; this module handles
 * parameter parsing, clamping, and building the standard response envelope.
 *
 * ## Contract
 *
 * Every paginated list endpoint MUST:
 *   1. Accept `limit` (default 20, max 100) and `offset` (default 0, min 0)
 *      OR `cursor` (opaque string, default "0") and `limit`.
 *   2. Return the `PaginatedResult<T>` envelope produced by `paginate()` /
 *      `paginateCursor()`.
 *   3. Document both modes in the OpenAPI spec / interactive API reference.
 *
 * See docs/api/interactive-api-reference.md § Pagination for the full contract.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed, validated offset-pagination parameters. */
export interface OffsetParams {
  /** Number of items to return. Clamped to [1, MAX_PAGE_SIZE]. */
  limit: number;
  /** Number of items to skip. Clamped to [0, ∞). */
  offset: number;
}

/** Parsed, validated cursor-pagination parameters. */
export interface CursorParams {
  /** Opaque cursor string (defaults to "0"). */
  cursor: string;
  /** Number of items to return. Clamped to [1, MAX_PAGE_SIZE]. */
  limit: number;
}

/** Standard envelope returned by offset-paginated list endpoints. */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

/** Standard envelope returned by cursor-paginated list endpoints. */
export interface CursorPaginatedResult<T> {
  data: T[];
  pagination: {
    limit: number;
    cursor: string;
    nextCursor: string | null;
    hasMore: boolean;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MIN_OFFSET = 0;

// ---------------------------------------------------------------------------
// Parameter parsing
// ---------------------------------------------------------------------------

/**
 * Parse and validate offset-pagination query parameters from an Express
 * request query object (or any plain object).
 *
 * - `limit`  parsed as integer, clamped to [1, MAX_PAGE_SIZE]. Defaults to DEFAULT_PAGE_SIZE.
 * - `offset` parsed as integer, clamped to [0, ∞). Defaults to 0.
 *
 * Non-numeric / NaN values fall back to defaults, so callers never receive
 * NaN in their service layer.
 *
 * @example
 * const { limit, offset } = parseOffsetParams(req.query);
 */
export function parseOffsetParams(
  query: Record<string, unknown>,
  defaults: Partial<OffsetParams> = {}
): OffsetParams {
  const rawLimit = parseInt(String(query['limit'] ?? ''), 10);
  const rawOffset = parseInt(String(query['offset'] ?? ''), 10);

  const limit = clampLimit(Number.isFinite(rawLimit) ? rawLimit : (defaults.limit ?? DEFAULT_PAGE_SIZE));
  const offset = clampOffset(Number.isFinite(rawOffset) ? rawOffset : (defaults.offset ?? MIN_OFFSET));

  return { limit, offset };
}

/**
 * Parse and validate cursor-pagination query parameters.
 *
 * - `cursor` string value, defaults to "0".
 * - `limit`  parsed as integer, clamped to [1, MAX_PAGE_SIZE].
 *
 * @example
 * const { cursor, limit } = parseCursorParams(req.query);
 */
export function parseCursorParams(
  query: Record<string, unknown>,
  defaults: Partial<CursorParams> = {}
): CursorParams {
  const rawLimit = parseInt(String(query['limit'] ?? ''), 10);
  const cursor =
    typeof query['cursor'] === 'string' && query['cursor'].length > 0
      ? query['cursor']
      : (defaults.cursor ?? '0');

  const limit = clampLimit(Number.isFinite(rawLimit) ? rawLimit : (defaults.limit ?? DEFAULT_PAGE_SIZE));

  return { cursor, limit };
}

// ---------------------------------------------------------------------------
// Result builders
// ---------------------------------------------------------------------------

/**
 * Build a `PaginatedResult<T>` from an already-fetched page slice.
 *
 * @param data   The items for this page (already sliced from offset to offset+limit).
 * @param total  Total number of items matching the filter (before pagination).
 * @param params Parsed pagination parameters (from `parseOffsetParams`).
 *
 * @example
 * const params = parseOffsetParams(req.query);
 * const [data, total] = await Promise.all([
 *   db.items.findMany({ take: params.limit, skip: params.offset }),
 *   db.items.count(),
 * ]);
 * res.json(paginate(data, total, params));
 */
export function paginate<T>(
  data: T[],
  total: number,
  params: OffsetParams
): PaginatedResult<T> {
  const { limit, offset } = params;
  const safeTotal = Math.max(0, total);
  return {
    data,
    pagination: {
      limit,
      offset,
      total: safeTotal,
      hasMore: offset + data.length < safeTotal,
    },
  };
}

/**
 * Build a `CursorPaginatedResult<T>` from an already-fetched page slice.
 *
 * The convention for the default numeric-cursor scheme:
 *   - `cursor` is a stringified integer representing the index of the first item to return.
 *   - `nextCursor` is the stringified index of the first item on the *next* page,
 *     or `null` when this is the last page.
 *
 * You can override this by passing a custom `nextCursor` value (e.g. for
 * opaque DB cursors from Prisma's `cursor` field).
 *
 * @param data       The items for this page.
 * @param params     Parsed cursor parameters (from `parseCursorParams`).
 * @param total      Total number of items, if known (used to compute `hasMore` when provided).
 * @param nextCursor Override for the next cursor value. When omitted, computed from `cursor + limit`.
 *
 * @example
 * const params = parseCursorParams(req.query);
 * const startIndex = parseInt(params.cursor, 10) || 0;
 * const data = allItems.slice(startIndex, startIndex + params.limit);
 * res.json(paginateCursor(data, params));
 */
export function paginateCursor<T>(
  data: T[],
  params: CursorParams,
  total?: number,
  nextCursor?: string | null
): CursorPaginatedResult<T> {
  const { cursor, limit } = params;
  const hasMore = computeHasMore(data, limit, total);

  let resolvedNextCursor: string | null;
  if (nextCursor !== undefined) {
    resolvedNextCursor = nextCursor;
  } else if (hasMore) {
    // Numeric-cursor default: advance by limit
    const currentIndex = parseInt(cursor, 10);
    resolvedNextCursor = Number.isFinite(currentIndex)
      ? String(currentIndex + limit)
      : null;
  } else {
    resolvedNextCursor = null;
  }

  return {
    data,
    pagination: {
      limit,
      cursor,
      nextCursor: resolvedNextCursor,
      hasMore,
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory slice helper (for mock-data or array-backed endpoints)
// ---------------------------------------------------------------------------

/**
 * Apply offset-pagination to an in-memory array and return a `PaginatedResult`.
 *
 * Handles out-of-range offsets gracefully (returns empty `data` with correct `total`).
 *
 * @example
 * const result = paginateArray(allItems, parseOffsetParams(req.query));
 * res.json(result);
 */
export function paginateArray<T>(items: T[], params: OffsetParams): PaginatedResult<T> {
  const { limit, offset } = params;
  const total = items.length;
  // Out-of-range offset → return empty page, not an error
  const safeOffset = Math.min(offset, total);
  const data = items.slice(safeOffset, safeOffset + limit);
  return paginate(data, total, { limit, offset: safeOffset });
}

/**
 * Apply cursor-pagination to an in-memory array using numeric cursors.
 *
 * @example
 * const result = paginateCursorArray(allItems, parseCursorParams(req.query));
 * res.json(result);
 */
export function paginateCursorArray<T>(items: T[], params: CursorParams): CursorPaginatedResult<T> {
  const { cursor, limit } = params;
  const startIndex = Math.max(0, parseInt(cursor, 10) || 0);
  const total = items.length;
  // Out-of-range cursor → return empty page
  const safeStart = Math.min(startIndex, total);
  const data = items.slice(safeStart, safeStart + limit);
  const hasMore = safeStart + data.length < total;
  const nextCursor = hasMore ? String(safeStart + limit) : null;
  return paginateCursor(data, { cursor: String(safeStart), limit }, total, nextCursor);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clampLimit(value: number): number {
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

function clampOffset(value: number): number {
  return Math.max(MIN_OFFSET, Math.floor(value));
}

function computeHasMore<T>(data: T[], limit: number, total?: number): boolean {
  if (total !== undefined) {
    return data.length > 0 && data.length >= limit;
  }
  // Without total, fall back to: if we got a full page there may be more
  return data.length >= limit;
}
