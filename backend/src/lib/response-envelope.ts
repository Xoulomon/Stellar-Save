/**
 * Standard API Response Envelope
 *
 * All API responses follow a consistent shape: { data, meta, errors }
 * This ensures predictable frontend consumption and consistent error handling.
 *
 * Usage:
 *   // Success with data
 *   res.json(createEnvelope(profileData));
 *
 *   // Success with metadata
 *   res.json(createEnvelope(items, { count: items.length, page: 1 }));
 *
 *   // Error response
 *   res.status(400).json(errorEnvelope('VALIDATION_ERROR', 'Invalid input'));
 */

/**
 * Standard error object shape
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Response metadata (pagination, timing, etc.)
 */
export interface ResponseMeta {
  count?: number;
  page?: number;
  pageSize?: number;
  total?: number;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Standard API response envelope
 */
export interface ApiResponseEnvelope<T = unknown> {
  data: T | null;
  meta?: ResponseMeta;
  errors?: ApiError[];
}

/**
 * Create a successful response envelope
 *
 * @param data - The response payload
 * @param meta - Optional metadata (pagination, timing, etc.)
 * @returns ApiResponseEnvelope with data and optional meta
 */
export function createEnvelope<T>(
  data: T,
  meta?: ResponseMeta
): ApiResponseEnvelope<T> {
  return {
    data,
    ...(meta !== undefined && { meta }),
  };
}

/**
 * Create a successful response envelope with array data
 *
 * @param items - Array of items
 * @param meta - Optional metadata with pagination info
 * @returns ApiResponseEnvelope with data array and optional meta
 */
export function createEnvelopeWithPagination<T>(
  items: T[],
  meta?: ResponseMeta
): ApiResponseEnvelope<T[]> {
  const fullMeta: ResponseMeta = {
    count: items.length,
    ...meta,
  };
  return createEnvelope(items, fullMeta);
}

/**
 * Create an error response envelope
 *
 * @param code - Error code (e.g., 'VALIDATION_ERROR')
 * @param message - Human-readable error message
 * @param details - Optional error details
 * @returns ApiResponseEnvelope with errors array and null data
 */
export function errorEnvelope(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ApiResponseEnvelope<null> {
  return {
    data: null,
    errors: [
      {
        code,
        message,
        ...(details && { details }),
      },
    ],
  };
}

/**
 * Create an error response envelope with multiple errors
 *
 * @param errors - Array of error objects or { code, message, details }
 * @returns ApiResponseEnvelope with errors array and null data
 */
export function errorEnvelopeMulti(
  errors: Array<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>
): ApiResponseEnvelope<null> {
  return {
    data: null,
    errors,
  };
}

/**
 * Create an empty success response (for operations with no return data)
 *
 * @param meta - Optional metadata
 * @returns ApiResponseEnvelope with null data
 */
export function createEmptyEnvelope(meta?: ResponseMeta): ApiResponseEnvelope<null> {
  return {
    data: null,
    ...(meta !== undefined && { meta }),
  };
}

/**
 * Transform a response to the envelope format
 * Preserves existing envelope structure, wraps plain objects/arrays
 *
 * @param response - The response to normalize
 * @returns ApiResponseEnvelope
 */
export function normalizeResponse(response: unknown): ApiResponseEnvelope {
  // Already an envelope
  if (isEnvelope(response)) {
    return response;
  }

  // Array → wrap in envelope with count
  if (Array.isArray(response)) {
    return createEnvelopeWithPagination(response);
  }

  // Plain object or primitive → wrap in envelope
  return createEnvelope(response);
}

/**
 * Type guard: is the value already a standard response envelope?
 *
 * An envelope is a non-null object with a `data` key and at least one of
 * `meta` or `errors`.
 */
export function isEnvelope(value: unknown): value is ApiResponseEnvelope {
  return (
    value !== null &&
    typeof value === 'object' &&
    'data' in value &&
    ('meta' in value || 'errors' in value)
  );
}
