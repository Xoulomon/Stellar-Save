/**
 * Generic API envelope types used by backend route handlers and consumed
 * by frontend/mobile API clients.
 *
 * Keeping these here (rather than duplicating them in backend/src and
 * frontend/src) ensures the response shapes never drift between the
 * producer and consumers.
 */

import type { PaginationMeta } from './domain';

/** Standard error response body returned by all API endpoints. */
export interface ApiError {
  code: string;
  message: string;
  /** Field-level validation errors, keyed by field path. */
  errors?: Record<string, string[]>;
}

/**
 * Generic success envelope wrapping a single resource or action result.
 *
 * @template T  The payload type.
 */
export interface ApiResponse<T> {
  data: T;
  /** ISO-8601 timestamp of the response. */
  timestamp: string;
}

/**
 * Paginated list response wrapping an array of items and cursor metadata.
 *
 * @template T  The item type.
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
  /** ISO-8601 timestamp of the response. */
  timestamp: string;
}
