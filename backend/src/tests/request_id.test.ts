import { requestId } from '../middleware/requestId';
import { getCorrelationId, getRequestContext } from '../lib/requestContext';

function makeReqRes(headers: Record<string, string> = {}) {
  const resHeaders: Record<string, string> = {};
  const req = { method: 'GET', path: '/api/v1/thing', headers } as any;
  const res = {
    setHeader: (k: string, v: string) => {
      resHeaders[k.toLowerCase()] = v;
    },
    getHeader: (k: string) => resHeaders[k.toLowerCase()],
  } as any;
  return { req, res, resHeaders };
}

describe('requestId middleware', () => {
  it('generates a correlation id and echoes it on the response header', () => {
    const { req, res, resHeaders } = makeReqRes();
    let called = false;

    requestId(req, res, () => {
      called = true;
    });

    expect(called).toBe(true);
    expect(resHeaders['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('reuses an inbound x-correlation-id header', () => {
    const inbound = '11111111-2222-3333-4444-555555555555';
    const { req, res, resHeaders } = makeReqRes({ 'x-correlation-id': inbound });

    requestId(req, res, () => {});

    expect(resHeaders['x-correlation-id']).toBe(inbound);
  });

  it('exposes the correlation id via async context inside next()', () => {
    const { req, res, resHeaders } = makeReqRes();
    let seen: string | undefined;
    let ctxPath: string | undefined;

    requestId(req, res, () => {
      seen = getCorrelationId();
      ctxPath = getRequestContext()?.path;
    });

    expect(seen).toBe(resHeaders['x-correlation-id']);
    expect(ctxPath).toBe('/api/v1/thing');
  });

  it('does not leak the async context after the request completes', () => {
    const { req, res } = makeReqRes();
    requestId(req, res, () => {});
    expect(getCorrelationId()).toBeUndefined();
  });
});
