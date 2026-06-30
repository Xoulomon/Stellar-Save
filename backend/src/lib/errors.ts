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

export function toEnvelope(err: unknown, correlationId: string): ErrorEnvelope {
  const timestamp = new Date().toISOString();
  if (err instanceof AppError) {
    return { code: err.code, message: err.message, details: err.details, correlationId, timestamp };
  }
  const message = err instanceof Error ? err.message : 'An unexpected error occurred';
  return { code: 'INTERNAL_ERROR', message, correlationId, timestamp };
}
