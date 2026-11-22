import { requestId } from './requestId';

import type { NextFunction, Request, Response } from 'express';

export { getCorrelationId, getRequestContext, runWithRequestContext } from '../lib/requestContext';
export type { RequestContext } from '../lib/requestContext';

export const correlationHeaders = {
  requestId: 'x-request-id',
  traceId: 'x-trace-id',
  spanId: 'x-span-id',
} as const;

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  requestId(req, res, next);
}
