/**
 * Typed application error hierarchy.
 *
 * Every client-caused failure should be thrown as an `AppError` subclass so the
 * global error handler can map it to a stable HTTP status and error code.
 */

export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UPSTREAM_FAILURE'
  | 'INTERNAL_ERROR';

/**
 * Canonical error payload used inside the standardized API response envelope.
 *
 * Shape: `{ code, message, details?, correlationId?, timestamp }`.
 */
export interface ApiError {
  code: AppErrorCode;
  message: string;
  details?: unknown;
  correlationId?: string;
  timestamp: string;
}

/**
 * Canonical mapping from error code to HTTP status.
 *
 * This is the single source of truth for status codes; subclasses derive their
 * status from it so the mapping can never drift between classes.
 */
export const HTTP_STATUS_BY_CODE: Readonly<Record<AppErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UPSTREAM_FAILURE: 502,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly status: number;
  readonly code: AppErrorCode;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(
    message: string,
    status: number,
    code: AppErrorCode,
    details?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Map this error to the canonical `ApiError` shape.
   *
   * @param correlationId Optional request correlation id to attach.
   * @param timestamp Optional ISO timestamp (defaults to now).
   */
  toEnvelope(correlationId?: string, timestamp = new Date().toISOString()): ApiError {
    const envelope: ApiError = {
      code: this.code,
      message: this.message,
      timestamp,
    };
    if (this.details !== undefined) {
      envelope.details = this.details;
    }
    if (correlationId !== undefined) {
      envelope.correlationId = correlationId;
    }
    return envelope;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: unknown) {
    super(message, HTTP_STATUS_BY_CODE.VALIDATION_ERROR, 'VALIDATION_ERROR', details);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, HTTP_STATUS_BY_CODE.UNAUTHORIZED, 'UNAUTHORIZED', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, HTTP_STATUS_BY_CODE.NOT_FOUND, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(message, HTTP_STATUS_BY_CODE.CONFLICT, 'CONFLICT', details);
  }
}

export class UpstreamError extends AppError {
  constructor(message = 'Upstream service failure', details?: unknown) {
    super(message, HTTP_STATUS_BY_CODE.UPSTREAM_FAILURE, 'UPSTREAM_FAILURE', details);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/**
 * Resolve the HTTP status code for any thrown value.
 *
 * Known `AppError`s expose their own status; anything else is treated as an
 * unexpected internal failure (500).
 */
export function statusCodeOf(err: unknown): number {
  return isAppError(err) ? err.status : HTTP_STATUS_BY_CODE.INTERNAL_ERROR;
}

/**
 * Map any thrown value to the canonical `ApiError` shape.
 *
 * Non-`AppError` values are normalized to an `INTERNAL_ERROR` envelope so raw
 * exception messages are never leaked to clients.
 */
export function toEnvelope(
  err: unknown,
  correlationId?: string,
  timestamp = new Date().toISOString(),
): ApiError {
  if (isAppError(err)) {
    return err.toEnvelope(correlationId, timestamp);
  }
  const envelope: ApiError = {
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    timestamp,
  };
  if (correlationId !== undefined) {
    envelope.correlationId = correlationId;
  }
  return envelope;
}
