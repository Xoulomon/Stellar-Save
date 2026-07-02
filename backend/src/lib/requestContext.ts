import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

export interface RequestContext {
  correlationId: string;
  method?: string;
  path?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function createCorrelationId(): string {
  return randomUUID();
}

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getCorrelationId(): string | undefined {
  return requestContextStorage.getStore()?.correlationId;
}

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
