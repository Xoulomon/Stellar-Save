import { apiKeyAuthMiddleware, recordApiUsage, ApiKeyRequest } from '../api_key_rate_limiter';

jest.mock('../api_key_service', () => ({
  apiKeyService: {
    validateKey: jest.fn(),
    recordUsage: jest.fn(),
  },
}));

jest.mock('../logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { apiKeyService } from '../api_key_service';

const mockValidateKey = apiKeyService.validateKey as jest.Mock;
const mockRecordUsage = apiKeyService.recordUsage as jest.Mock;

function makeReqResNext() {
  const req = { headers: {} as Record<string, string>, path: '/api/v1/groups', method: 'GET' } as ApiKeyRequest;
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const next = jest.fn();
  return { req, res: res as unknown as import('express').Response, next };
}

describe('apiKeyAuthMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a request with no x-api-key header', async () => {
    const { req, res, next } = makeReqResNext();

    await apiKeyAuthMiddleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired key', async () => {
    const { req, res, next } = makeReqResNext();
    req.headers['x-api-key'] = 'ss_bad';
    mockValidateKey.mockResolvedValue({ valid: false });

    await apiKeyAuthMiddleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and attaches apiKey context for a valid key under the rate limit', async () => {
    const { req, res, next } = makeReqResNext();
    req.headers['x-api-key'] = 'ss_good';
    mockValidateKey.mockResolvedValue({ valid: true, keyId: 'key-1', userId: 'user-1', rateLimit: 100 });

    await apiKeyAuthMiddleware(req, res, next);

    expect(req.apiKey).toEqual({ keyId: 'key-1', userId: 'user-1' });
    expect(next).toHaveBeenCalled();
  });

  it('rejects once the per-key rate limit is exceeded', async () => {
    mockValidateKey.mockResolvedValue({ valid: true, keyId: 'key-limited', userId: 'user-1', rateLimit: 1 });

    const first = makeReqResNext();
    first.req.headers['x-api-key'] = 'ss_limited';
    await apiKeyAuthMiddleware(first.req, first.res, first.next);
    expect(first.next).toHaveBeenCalled();

    const second = makeReqResNext();
    second.req.headers['x-api-key'] = 'ss_limited';
    await apiKeyAuthMiddleware(second.req, second.res, second.next);

    expect(second.res.statusCode).toBe(429);
    expect(second.next).not.toHaveBeenCalled();
  });
});

describe('recordApiUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('records usage with the resolved status code when apiKey context is present', async () => {
    const { req, res } = makeReqResNext();
    req.apiKey = { keyId: 'key-1', userId: 'user-1' };
    res.statusCode = 201;

    await recordApiUsage(req, res);

    expect(mockRecordUsage).toHaveBeenCalledWith('key-1', req.path, req.method, 201);
  });

  it('does nothing when no apiKey context is present', async () => {
    const { req, res } = makeReqResNext();

    await recordApiUsage(req, res);

    expect(mockRecordUsage).not.toHaveBeenCalled();
  });
});
