import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

/**
 * Canonical application error with an HTTP status and stable error code.
 * All backend errors should extend or be normalized into this shape so that
 * responses are consistent across the API.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    isOperational = true,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details?: unknown) {
    super(message, 400, code, true, details);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED', details?: unknown) {
    super(message, 401, code, true, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN', details?: unknown) {
    super(message, 403, code, true, details);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found', code = 'NOT_FOUND', details?: unknown) {
    super(message, 404, code, true, details);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT', details?: unknown) {
    super(message, 409, code, true, details);
    this.name = 'ConflictError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', code = 'VALIDATION_ERROR', details?: unknown) {
    super(message, 422, code, true, details);
    this.name = 'ValidationError';
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal server error', code = 'INTERNAL_ERROR', details?: unknown) {
    super(message, 500, code, false, details);
    this.name = 'InternalServerError';
  }
}

export interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Normalize any thrown value into an AppError so the response shape is stable.
 */
export function normalizeError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }
  if (err instanceof Error) {
    return new AppError(err.message || 'Internal server error', 500, 'INTERNAL_ERROR', false);
  }
  return new AppError('Internal server error', 500, 'INTERNAL_ERROR', false);
}

/**
 * Build the canonical HTTP error response body.
 */
export function buildErrorResponse(err: AppError): ErrorResponseBody {
  const body: ErrorResponseBody = {
    success: false,
    error: {
      code: err.code,
      message: err.message,
    },
  };
  if (err.details !== undefined) {
    body.error.details = err.details;
  }
  return body;
}

/**
 * Express error-handling middleware. Produces a consistent JSON error body
 * and logs unexpected (non-operational) errors.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const appError = normalizeError(err);

  if (!appError.isOperational) {
    logger.error('Unhandled error', {
      message: appError.message,
      code: appError.code,
      path: req.path,
      method: req.method,
      stack: appError.stack,
    });
  }

  if (res.headersSent) {
    return;
  }

  res.status(appError.statusCode).json(buildErrorResponse(appError));
}

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req: Request, res: Response): void {
  const err = new NotFoundError(`Route not found: ${req.method} ${req.path}`);
  res.status(err.statusCode).json(buildErrorResponse(err));
}

export default errorHandler;
