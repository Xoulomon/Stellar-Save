/**
 * fiat_ramp_protection.ts
 *
 * Dedicated abuse protection for fiat on/off-ramp and KYC endpoints.
 * Layered on top of the general rate limiter with stricter policies:
 *
 *  1. Per-IP rate limit  — 5 ramp/KYC requests per 15 minutes
 *  2. Per-user velocity  — max 3 deposit initiations per hour
 *  3. Anomaly flagging   — logs + alerts when thresholds are breached
 *  4. PoW / CAPTCHA gate — require a solved challenge token on
 *                          unauthenticated ramp entry points
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { Counter } from 'prom-client';
import { registry } from './metrics';
import { config } from './config';

// ── Metrics ───────────────────────────────────────────────────────────────────

const rampRateLimitBreaches = new Counter({
  name: 'fiat_ramp_rate_limit_breaches_total',
  help: 'Number of times a fiat-ramp rate limit was breached',
  labelNames: ['limit_type', 'endpoint'],
  registers: [registry],
});

const rampAnomalyFlags = new Counter({
  name: 'fiat_ramp_anomaly_flags_total',
  help: 'Number of anomaly flags raised on ramp endpoints',
  labelNames: ['reason', 'endpoint'],
  registers: [registry],
});

// ── Sliding-window store (in-process; swap for Redis in multi-instance setups) ─

interface WindowEntry {
  timestamps: number[];
}

class InMemoryVelocityStore {
  private readonly buckets = new Map<string, WindowEntry>();

  /** Record a hit and return the count within [nowMs - windowMs, nowMs]. */
  record(key: string, windowMs: number, nowMs: number): number {
    const cutoff = nowMs - windowMs;
    const entry = this.buckets.get(key) ?? { timestamps: [] };
    entry.timestamps = entry.timestamps.filter(ts => ts > cutoff);
    entry.timestamps.push(nowMs);
    this.buckets.set(key, entry);
    return entry.timestamps.length;
  }

  /** Peek without recording. */
  count(key: string, windowMs: number, nowMs: number): number {
    const cutoff = nowMs - windowMs;
    const entry = this.buckets.get(key);
    if (!entry) return 0;
    return entry.timestamps.filter(ts => ts > cutoff).length;
  }
}

const velocityStore = new InMemoryVelocityStore();

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
}

function extractUserId(req: Request): string | undefined {
  const r = req as Request & { userId?: string; user?: { id?: string } };
  return r.userId ?? r.user?.id ?? (req.headers['x-user-id'] as string | undefined);
}

function sendRateLimitResponse(
  res: Response,
  retryAfterSeconds: number,
  reason: string,
): void {
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({ error: 'Too many requests', reason, retryAfterSeconds });
}

function logAndAlert(
  req: Request,
  limitType: string,
  detail: Record<string, unknown>,
): void {
  const endpoint = req.path;
  logger.warn('[fiat-ramp] rate limit breach', {
    limitType,
    endpoint,
    ip: extractIp(req),
    userId: extractUserId(req),
    ...detail,
  });

  rampRateLimitBreaches.inc({ limit_type: limitType, endpoint });
}

function flagAnomaly(
  req: Request,
  reason: string,
  detail: Record<string, unknown>,
): void {
  const endpoint = req.path;
  logger.error('[fiat-ramp] anomaly detected', {
    reason,
    endpoint,
    ip: extractIp(req),
    userId: extractUserId(req),
    ...detail,
  });

  rampAnomalyFlags.inc({ reason, endpoint });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WINDOW_15_MIN = 15 * 60 * 1000;
const WINDOW_1_HOUR = 60 * 60 * 1000;

// Stricter per-IP limit for ramp endpoints
const IP_MAX_PER_15_MIN = 5;

// Per-user velocity: max deposits per hour
const USER_MAX_DEPOSITS_PER_HOUR = 3;

// Anomaly threshold: flag if the same IP hits > this many times in 1 hour
const IP_ANOMALY_THRESHOLD_PER_HOUR = 20;

// ── Middleware factories ───────────────────────────────────────────────────────

/**
 * rampIpRateLimiter — 5 requests / 15 min per IP.
 * Apply to all fiat-ramp and KYC routes.
 */
export function rampIpRateLimiter(now = Date.now.bind(Date)) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const nowMs = now();
    const ip = extractIp(req);
    const key = `ramp:ip:${ip}`;

    const count = velocityStore.record(key, WINDOW_15_MIN, nowMs);

    // Anomaly check: flag if far above normal even before hard limit
    const hourCount = velocityStore.count(`ramp:ip:hour:${ip}`, WINDOW_1_HOUR, nowMs);
    if (hourCount > IP_ANOMALY_THRESHOLD_PER_HOUR) {
      flagAnomaly(req, 'high_ip_volume', { ip, hourCount });
    }

    if (count > IP_MAX_PER_15_MIN) {
      logAndAlert(req, 'ip_15min', { ip, count });
      sendRateLimitResponse(res, 15 * 60, 'IP rate limit exceeded on ramp endpoint');
      return;
    }

    // Also record in the hourly bucket (for anomaly detection only, no block)
    velocityStore.record(`ramp:ip:hour:${ip}`, WINDOW_1_HOUR, nowMs);

    next();
  };
}

/**
 * rampUserVelocityLimiter — max 3 deposit initiations per hour per user.
 * Apply to POST /ramp/deposit and POST /ramp/initiate endpoints.
 */
export function rampUserVelocityLimiter(now = Date.now.bind(Date)) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const nowMs = now();
    const userId = extractUserId(req);

    if (!userId) {
      // Unauthenticated — let the PoW gate handle it; pass through here
      next();
      return;
    }

    const key = `ramp:user:deposit:${userId}`;
    const count = velocityStore.record(key, WINDOW_1_HOUR, nowMs);

    if (count > USER_MAX_DEPOSITS_PER_HOUR) {
      logAndAlert(req, 'user_deposit_velocity', { userId, count });
      sendRateLimitResponse(res, 60 * 60, 'Deposit velocity limit exceeded');
      return;
    }

    next();
  };
}

/**
 * rampCaptchaGate — verify a CAPTCHA / proof-of-work token on unauthenticated
 * ramp entry points.
 *
 * Expects the client to send `X-Captcha-Token` header or `captchaToken` body
 * field.  In production, integrate with your CAPTCHA provider here (hCaptcha,
 * Cloudflare Turnstile, etc.).  This middleware enforces the check contract so
 * the integration point is clear; replace `verifyCaptchaToken` with the real
 * verification call.
 */
export function rampCaptchaGate() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = extractUserId(req);

    // Authenticated users bypass CAPTCHA
    if (userId) {
      next();
      return;
    }

    const token =
      (req.headers['x-captcha-token'] as string | undefined) ??
      (req.body as Record<string, unknown>)?.captchaToken as string | undefined;

    if (!token) {
      flagAnomaly(req, 'missing_captcha_token', { path: req.path });
      res.status(403).json({ error: 'CAPTCHA token required for unauthenticated ramp access' });
      return;
    }

    const valid = await verifyCaptchaToken(token, extractIp(req));
    if (!valid) {
      flagAnomaly(req, 'invalid_captcha_token', { path: req.path });
      res.status(403).json({ error: 'Invalid or expired CAPTCHA token' });
      return;
    }

    next();
  };
}

/**
 * Verify a CAPTCHA token against the configured provider.
 *
 * Replace this stub with the real provider SDK call, e.g.:
 *   - hCaptcha:   POST https://hcaptcha.com/siteverify
 *   - Turnstile:  POST https://challenges.cloudflare.com/turnstile/v0/siteverify
 *
 * The function must return `true` only when the token is valid and has not
 * already been used (replay protection).
 */
async function verifyCaptchaToken(token: string, _remoteIp: string): Promise<boolean> {
  const secret = config.captcha.secretKey;
  if (!secret) {
    if (config.nodeEnv === 'production') {
      logger.error('[fiat-ramp] CAPTCHA_SECRET_KEY not set in production');
      return false;
    }
    logger.warn('[fiat-ramp] CAPTCHA_SECRET_KEY not set; skipping verification in dev');
    return true;
  }

  // Stub: replace with real HTTP call to your CAPTCHA provider
  // Example for hCaptcha:
  // const resp = await fetch('https://hcaptcha.com/siteverify', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  //   body: `secret=${encodeURIComponent(secret)}&response=${encodeURIComponent(token)}&remoteip=${encodeURIComponent(_remoteIp)}`,
  // });
  // const json = await resp.json();
  // return json.success === true;

  return typeof token === 'string' && token.length > 0;
}

/**
 * Convenience: compose all ramp protections in the correct order.
 *
 * Usage in your router:
 *   router.post('/ramp/deposit', ...rampProtection(), handler);
 *   router.post('/kyc/submit',   ...rampProtection({ velocityCheck: false }), handler);
 */
export function rampProtection(opts: { velocityCheck?: boolean } = {}) {
  const { velocityCheck = true } = opts;
  const middlewares = [
    rampIpRateLimiter(),
    rampCaptchaGate(),
    ...(velocityCheck ? [rampUserVelocityLimiter()] : []),
  ];
  return middlewares;
}
