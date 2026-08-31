import { Request, Response, NextFunction } from 'express';
import { validateBody, validateQuery, validateParams, schemas } from '../lib/validation';
import { AppError } from '../lib/errors';

function makeReq(body: unknown = {}, query: unknown = {}, params: unknown = {}): Request {
  return { body, query, params } as unknown as Request;
}

function makeRes(): Response {
  return {} as Response;
}

function captureNext(): { next: NextFunction; calls: unknown[] } {
  const calls: unknown[] = [];
  const next: NextFunction = (arg?: unknown) => { calls.push(arg); };
  return { next, calls };
}

// ── validateBody ─────────────────────────────────────────────────────────────

describe('validateBody', () => {
  describe('schemas.authChallenge', () => {
    const mw = validateBody(schemas.authChallenge);

    it('passes a valid Stellar address', () => {
      const req = makeReq({ walletAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls).toHaveLength(1);
      expect(calls[0]).toBeUndefined();
    });

    it('strips whitespace from walletAddress', () => {
      const req = makeReq({ walletAddress: '  GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN  ' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeUndefined();
      expect((req as any).body.walletAddress).toBe('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN');
    });

    it('rejects missing walletAddress', () => {
      const req = makeReq({});
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeInstanceOf(AppError);
      expect((calls[0] as AppError).statusCode).toBe(400);
      expect((calls[0] as AppError).code).toBe('VALIDATION_ERROR');
    });

    it('rejects invalid Stellar address format', () => {
      const req = makeReq({ walletAddress: 'not-a-stellar-key' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeInstanceOf(AppError);
      expect((calls[0] as AppError).message).toContain('Invalid Stellar wallet address');
    });
  });

  describe('schemas.authVerify', () => {
    const mw = validateBody(schemas.authVerify);
    const base = {
      walletAddress: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
      challenge: 'some-challenge',
      signature: 'base64sig==',
    };

    it('passes a valid body', () => {
      const req = makeReq({ ...base });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeUndefined();
    });

    it('rejects when signature is missing', () => {
      const { signature: _, ...noSig } = base;
      const req = makeReq(noSig);
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeInstanceOf(AppError);
    });
  });

  describe('schemas.authRefresh', () => {
    const mw = validateBody(schemas.authRefresh);

    it('passes a non-empty refreshToken', () => {
      const req = makeReq({ refreshToken: 'tok123' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeUndefined();
    });

    it('rejects an empty string', () => {
      const req = makeReq({ refreshToken: '' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeInstanceOf(AppError);
    });

    it('rejects when field is absent', () => {
      const req = makeReq({});
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeInstanceOf(AppError);
    });
  });

  describe('schemas.exportJob', () => {
    const mw = validateBody(schemas.exportJob);

    it('passes a valid export body (CSV)', () => {
      const req = makeReq({ userId: 'u1', email: 'test@example.com', format: 'CSV' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeUndefined();
    });

    it('passes a valid export body (JSON)', () => {
      const req = makeReq({ userId: 'u1', email: 'test@example.com', format: 'JSON' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeUndefined();
    });

    it('rejects invalid format', () => {
      const req = makeReq({ userId: 'u1', email: 'test@example.com', format: 'XML' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeInstanceOf(AppError);
    });

    it('rejects invalid email', () => {
      const req = makeReq({ userId: 'u1', email: 'not-an-email', format: 'JSON' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeInstanceOf(AppError);
    });
  });

  describe('schemas.backupTrigger', () => {
    const mw = validateBody(schemas.backupTrigger);

    it('accepts "full"', () => {
      const req = makeReq({ type: 'full' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeUndefined();
    });

    it('accepts "incremental"', () => {
      const req = makeReq({ type: 'incremental' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeUndefined();
    });

    it('rejects other types', () => {
      const req = makeReq({ type: 'partial' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeInstanceOf(AppError);
    });
  });

  describe('schemas.analyticsEventBody', () => {
    const mw = validateBody(schemas.analyticsEventBody);

    it('passes when eventType and eventName are present', () => {
      const req = makeReq({ eventType: 'click', eventName: 'button_pressed' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeUndefined();
    });

    it('rejects when eventType is missing', () => {
      const req = makeReq({ eventName: 'button_pressed' });
      const { next, calls } = captureNext();
      mw(req, makeRes(), next);
      expect(calls[0]).toBeInstanceOf(AppError);
    });
  });
});

// ── validateQuery ─────────────────────────────────────────────────────────────

describe('validateQuery', () => {
  describe('schemas.paginationQuery', () => {
    const mw = validateQuery(schemas.paginationQuery);

    it('applies defaults when query is empty', () => {
      const req = makeReq({}, {});
      const { next, calls } = captureNext();
      mw(req as any, makeRes(), next);
      expect(calls[0]).toBeUndefined();
      expect((req as any).validatedQuery).toEqual({ limit: 20, offset: 0 });
    });

    it('coerces string numbers', () => {
      const req = makeReq({}, { limit: '10', offset: '5' });
      const { next, calls } = captureNext();
      mw(req as any, makeRes(), next);
      expect(calls[0]).toBeUndefined();
      expect((req as any).validatedQuery).toEqual({ limit: 10, offset: 5 });
    });

    it('rejects limit above 100', () => {
      const req = makeReq({}, { limit: '200' });
      const { next, calls } = captureNext();
      mw(req as any, makeRes(), next);
      expect(calls[0]).toBeInstanceOf(AppError);
    });

    it('rejects negative offset', () => {
      const req = makeReq({}, { offset: '-1' });
      const { next, calls } = captureNext();
      mw(req as any, makeRes(), next);
      expect(calls[0]).toBeInstanceOf(AppError);
    });
  });
});

// ── Error shape ───────────────────────────────────────────────────────────────

describe('AppError shape from validation', () => {
  it('has code VALIDATION_ERROR, status 400, and a non-empty message', () => {
    const mw = validateBody(schemas.authChallenge);
    const req = makeReq({ walletAddress: 'bad' });
    const { next, calls } = captureNext();
    mw(req, makeRes(), next);
    const err = calls[0] as AppError;
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
    expect(err.message.length).toBeGreaterThan(0);
  });
});
