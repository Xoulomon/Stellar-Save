import { Request, Response, NextFunction } from 'express';
import {
  rampIpRateLimiter,
  rampUserVelocityLimiter,
  rampCaptchaGate,
} from '../fiat_ramp_protection';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ip: '1.2.3.4',
    socket: { remoteAddress: '1.2.3.4' },
    path: '/api/ramp/deposit',
    body: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; status: jest.Mock; json: jest.Mock; setHeader: jest.Mock } {
  const json = jest.fn();
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const res = { status, json, setHeader } as unknown as Response;
  return { res, status, json, setHeader };
}

// ── rampIpRateLimiter ─────────────────────────────────────────────────────────

describe('rampIpRateLimiter', () => {
  it('allows requests within the limit', () => {
    let t = 0;
    const mw = rampIpRateLimiter(() => t++);
    const next = jest.fn();
    const req = makeReq({ ip: '10.0.0.1' });
    const { res } = makeRes();

    for (let i = 0; i < 5; i++) {
      mw(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks the 6th request from the same IP within the window', () => {
    const startMs = Date.now();
    let calls = 0;
    const mw = rampIpRateLimiter(() => startMs + calls++);

    const next = jest.fn();
    const req = makeReq({ ip: '10.0.0.2' });

    // 5 allowed
    for (let i = 0; i < 5; i++) {
      const { res } = makeRes();
      mw(req, res, next);
    }

    // 6th should be blocked
    const { res: blockedRes, status } = makeRes();
    mw(req, blockedRes, next);

    expect(status).toHaveBeenCalledWith(429);
    expect(next).toHaveBeenCalledTimes(5);
  });

  it('allows a new IP independently', () => {
    const startMs = Date.now();
    let calls = 0;
    const mw = rampIpRateLimiter(() => startMs + calls++);
    const next = jest.fn();

    // Fill up IP A
    const reqA = makeReq({ ip: '10.1.1.1' });
    for (let i = 0; i < 5; i++) {
      const { res } = makeRes();
      mw(reqA, res, next);
    }

    // IP B should still be allowed
    const reqB = makeReq({ ip: '10.1.1.2' });
    const { res, status } = makeRes();
    mw(reqB, res, next);

    expect(status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(6);
  });
});

// ── rampUserVelocityLimiter ───────────────────────────────────────────────────

describe('rampUserVelocityLimiter', () => {
  it('passes through unauthenticated requests', () => {
    const mw = rampUserVelocityLimiter();
    const next = jest.fn();
    const req = makeReq(); // no userId
    const { res } = makeRes();
    mw(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows up to 3 deposits per hour per user', () => {
    const startMs = Date.now();
    let calls = 0;
    const mw = rampUserVelocityLimiter(() => startMs + calls++);
    const next = jest.fn();
    const req = makeReq({ headers: { 'x-user-id': 'user-abc' } });

    for (let i = 0; i < 3; i++) {
      const { res } = makeRes();
      mw(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(3);
  });

  it('blocks the 4th deposit from the same user within an hour', () => {
    const startMs = Date.now();
    let calls = 0;
    const mw = rampUserVelocityLimiter(() => startMs + calls++);
    const next = jest.fn();
    const req = makeReq({ headers: { 'x-user-id': 'user-xyz' } });

    for (let i = 0; i < 3; i++) {
      const { res } = makeRes();
      mw(req, res, next);
    }

    const { res: blockedRes, status } = makeRes();
    mw(req, blockedRes, next);

    expect(status).toHaveBeenCalledWith(429);
    expect(next).toHaveBeenCalledTimes(3);
  });
});

// ── rampCaptchaGate ───────────────────────────────────────────────────────────

describe('rampCaptchaGate', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'development', CAPTCHA_SECRET_KEY: '' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('bypasses gate for authenticated users (no token needed)', async () => {
    const mw = rampCaptchaGate();
    const next = jest.fn();
    const req = makeReq({ headers: { 'x-user-id': 'user-123' } });
    const { res, status } = makeRes();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated requests missing a captcha token', async () => {
    const mw = rampCaptchaGate();
    const next = jest.fn();
    const req = makeReq(); // no userId, no token
    const { res, status } = makeRes();

    await mw(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows unauthenticated requests with a captcha token in dev (no CAPTCHA_SECRET_KEY)', async () => {
    const mw = rampCaptchaGate();
    const next = jest.fn();
    const req = makeReq({ headers: { 'x-captcha-token': 'some-token' } });
    const { res, status } = makeRes();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(status).not.toHaveBeenCalled();
  });
});
