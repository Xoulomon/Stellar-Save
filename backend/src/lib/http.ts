import { getCorrelationId } from './requestContext';

type HeadersInitLike = HeadersInit | Record<string, string>;

function toHeaders(init?: HeadersInitLike): Headers {
  return new Headers(init ?? {});
}

export function withCorrelationHeaders(initHeaders?: HeadersInitLike): Headers {
  const headers = toHeaders(initHeaders);
  const correlationId = getCorrelationId();
  if (correlationId && !headers.has('x-correlation-id')) {
    headers.set('x-correlation-id', correlationId);
  }
  return headers;
}

export async function fetchWithCorrelationId(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: withCorrelationHeaders(init.headers),
  });
}

/**
 * Canonical HTTP error model shared across the backend.
 *
 * Before: error classes were duplicated across modules with inconsistent
 * status codes and ad-hoc response shapes.
 * After: a single `HttpError` hierarchy with a stable `code` and `status`,
 * plus `toErrorResponse` producing a consistent JSON body.
 */
export type HttpErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR';

export interface ErrorResponseBody {
  error: {
    code: HttpErrorCode;
    message: string;
    details?: unknown;
    correlationId?: string;
  };
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: HttpErrorCode;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    status: number,
    code: HttpErrorCode,
    message: string,
    options: { details?: unknown; expose?: boolean; cause?: unknown } = {}
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? status < 500;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class BadRequestError extends HttpError {
  constructor(message = 'Bad request', details?: unknown) {
    super(400, 'BAD_REQUEST', message, { details });
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, { details });
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(403, 'FORBIDDEN', message, { details });
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends HttpError {
  constructor(message = 'Not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, { details });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, 'CONFLICT', message, { details });
    this.name = 'ConflictError';
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message = 'Unprocessable entity', details?: unknown) {
    super(422, 'UNPROCESSABLE_ENTITY', message, { details });
    this.name = 'UnprocessableEntityError';
  }
}

export class TooManyRequestsError extends HttpError {
  constructor(message = 'Too many requests', details?: unknown) {
    super(429, 'TOO_MANY_REQUESTS', message, { details });
    this.name = 'TooManyRequestsError';
  }
}

export class InternalServerError extends HttpError {
  constructor(message = 'Internal server error', options: { details?: unknown; cause?: unknown } = {}) {
    super(500, 'INTERNAL_ERROR', message, { ...options, expose: false });
    this.name = 'InternalServerError';
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

/**
 * Normalize any thrown value into a consistent HTTP error response body.
 * Unknown errors are treated as 500s and never leak internal messages.
 */
export function toErrorResponse(error: unknown): { status: number; body: ErrorResponseBody } {
  const correlationId = getCorrelationId();

  if (isHttpError(error)) {
    const message = error.expose ? error.message : 'Internal server error';
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message,
          ...(error.expose && error.details !== undefined ? { details: error.details } : {}),
          ...(correlationId ? { correlationId } : {}),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        ...(correlationId ? { correlationId } : {}),
      },
    },
  };
}
