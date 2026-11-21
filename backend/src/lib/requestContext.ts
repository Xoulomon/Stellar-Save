import { randomUUID } from 'crypto';

import type { Request, Response } from 'express';

import {
  type RequestContext,
  runWithRequestContext,
  getRequestContext,
  getCorrelationId,
} from '../middleware/requestContext';

export type { RequestContext };

export function createCorrelationId(): string {
  return randomUUID();
}

export { runWithRequestContext, getRequestContext, getCorrelationId };

export function getRequestCorrelationId(req?: Request): string | undefined {
  return (
    (req?.headers['x-correlation-id'] as string | undefined) ||
    (req?.res?.getHeader('x-correlation-id') as string | undefined) ||
    getCorrelationId()
  );
}

export function attachCorrelationId(req: Request, res: Response): string {
  const correlationId = getRequestCorrelationId(req) || createCorrelationId();
  res.setHeader('x-correlation-id', correlationId);
  return correlationId;
}