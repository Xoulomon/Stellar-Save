export interface ErrorEnvelope {
  code: string;
  message: string;
  details?: unknown;
  correlationId: string;
  timestamp: string;
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super('NOT_FOUND', message, 404, details);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', details?: unknown) {
    super('UNAUTHORIZED', message, 401, details);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', details?: unknown) {
    super('FORBIDDEN', message, 403, details);
    this.name = 'ForbiddenError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, 409, details);
    this.name = 'ConflictError';
  }
}

export class CircuitBreakerOpenError extends AppError {
  constructor(message: string = 'Circuit breaker is OPEN') {
    super('CIRCUIT_OPEN', message, 503, undefined);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class ImageValidationError extends AppError {
  constructor(message: string) {
    super('IMAGE_VALIDATION_ERROR', message, 400, undefined);
    this.name = 'ImageValidationError';
  }
}

export { AppError as ApiError };

export function toEnvelope(err: unknown, correlationId: string): ErrorEnvelope {
  const timestamp = new Date().toISOString();
  if (err instanceof AppError) {
    return { code: err.code, message: err.message, details: err.details, correlationId, timestamp };
  }
  const message = err instanceof Error ? err.message : 'An unexpected error occurred';
  return { code: 'INTERNAL_ERROR', message, correlationId, timestamp };
}
