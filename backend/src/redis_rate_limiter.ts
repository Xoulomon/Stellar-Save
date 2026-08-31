import Redis from 'ioredis';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { Counter } from 'prom-client';
import { registry } from './metrics';
import redisClient from './redis';

export interface RateLimitWindow {
  windowMs: number;
  max: number;
  label: string;
}

export interface TierConfig {
  windows: RateLimitWindow[];
}

export interface EndpointCost {
  cost: number;
  category: 'read' | 'write' | 'sensitive' | 'admin';
}

export interface WindowResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number;
  windowMs: number;
}

export interface QuotaUsage {
  window: string;
  windowMs: number;
  limit: number;
  used: number;
  remaining: number;
  resetAt: number;
}

const rateLimitBreaches = new Counter({
  name: 'tiered_rate_limit_breaches_total',
  help: 'Total tiered rate limit breaches',
  labelNames: ['tier', 'scope', 'endpoint'],
  registers: [registry],
});

const rateLimitWarnings = new Counter({
  name: 'tiered_rate_limit_warnings_total',
  help: 'Total rate limit warnings issued',
  labelNames: ['tier', 'scope', 'level'],
  registers: [registry],
});

let TIERS: Record<string, TierConfig> = {
  free: {
    windows: [
      { windowMs: 60_000, max: 30, label: '1m' },
      { windowMs: 3_600_000, max: 500, label: '1h' },
    ],
  },
  pro: {
    windows: [
      { windowMs: 60_000, max: 300, label: '1m' },
      { windowMs: 3_600_000, max: 10_000, label: '1h' },
    ],
  },
  enterprise: {
    windows: [
      { windowMs: 60_000, max: 3_000, label: '1m' },
      { windowMs: 3_600_000, max: 100_000, label: '1h' },
    ],
  },
  admin: { windows: [] },
};

let ENDPOINT_COSTS: Record<string, EndpointCost> = {};
const DEFAULT_COST: EndpointCost = { cost: 1, category: 'read' };

export function setEndpointCost(path: string, cost: number, category: string = 'read'): void {
  ENDPOINT_COSTS[path] = { cost, category } as EndpointCost;
}

export function configureTier(tier: string, windows: RateLimitWindow[]): void {
  TIERS[tier] = { windows };
}

export function getTierConfig(tier: string): TierConfig | undefined {
  return TIERS[tier];
}

export function getConfiguredTiers(): string[] {
  return Object.keys(TIERS);
}

const SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local member = ARGV[5]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window_ms)
local count = redis.call('ZCARD', key)
local remaining = max - count - cost
local reset_at = now + window_ms

if remaining >= 0 then
  for i = 1, cost do
    redis.call('ZADD', key, now, member .. ':' .. i)
  end
  redis.call('PEXPIRE', key, window_ms)
  return {1, remaining, reset_at}
else
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  if oldest[2] then
    reset_at = tonumber(oldest[2]) + window_ms
  end
  return {0, math.max(0, max - count), reset_at}
end
`;

let scriptSha: string | null = null;

async function evalScript(
  redis: Redis,
  key: string,
  args: string[],
): Promise<[number, number, number]> {
  if (scriptSha) {
    try {
      const result = await redis.evalsha(scriptSha, 1, key, ...args);
      return result as [number, number, number];
    } catch {
      scriptSha = null;
    }
  }
  const result = await redis.eval(SCRIPT, 1, key, ...args);
  scriptSha = null;
  return result as [number, number, number];
}

async function checkWindow(
  redis: Redis,
  key: string,
  now: number,
  windowMs: number,
  max: number,
  cost: number,
  memberId: string,
): Promise<WindowResult> {
  const [allowed, remaining, resetAt] = await evalScript(redis, key, [
    String(now),
    String(windowMs),
    String(max),
    String(cost),
    memberId,
  ]);

  return {
    allowed: allowed === 1,
    limit: max,
    remaining,
    resetAt,
    retryAfter: Math.max(0, Math.ceil((resetAt - now) / 1000)),
    windowMs,
  };
}

function extractTier(req: Request): string {
  const r = req as any;
  if (r.adminId) return 'admin';
  if (r.apiKey?.tier && TIERS[r.apiKey.tier]) return r.apiKey.tier;
  if (r.user?.tier && TIERS[r.user.tier]) return r.user.tier;
  if (r.headers['authorization']) return 'pro';
  return 'free';
}

function extractUserId(req: Request): string | undefined {
  const r = req as any;
  return r.userId || r.adminId || r.user?.id || r.apiKey?.userId || undefined;
}

function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function matchEndpointCost(path: string): EndpointCost {
  if (ENDPOINT_COSTS[path]) return ENDPOINT_COSTS[path];

  for (const [pattern, cost] of Object.entries(ENDPOINT_COSTS)) {
    if (!pattern.includes(':')) continue;
    const patParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patParts.length !== pathParts.length) continue;
    let match = true;
    for (let i = 0; i < patParts.length; i++) {
      if (patParts[i].startsWith(':')) continue;
      if (patParts[i] !== pathParts[i]) { match = false; break; }
    }
    if (match) return cost;
  }

  return DEFAULT_COST;
}

export function createTieredRateLimiter(opts: { redis?: Redis } = {}) {
  const redis = opts.redis || (redisClient as any as Redis);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const now = Date.now();
    const tier = extractTier(req);
    const config = TIERS[tier];

    if (!config || config.windows.length === 0) {
      next();
      return;
    }

    const userId = extractUserId(req);
    const ip = extractIp(req);
    const path = req.path;
    const endpointCost = matchEndpointCost(path);
    const memberId = `${now}:${Math.random().toString(36).slice(2, 10)}:${ip}`;

    const identifier = userId || ip;
    const scope = userId ? 'user' : 'ip';

    const results: { result: WindowResult; window: RateLimitWindow }[] = [];

    for (const window of config.windows) {
      const key = `ratelimit:${scope}:${identifier}:${tier}:${window.windowMs}`;
      const result = await checkWindow(redis, key, now, window.windowMs, window.max, endpointCost.cost, memberId);
      results.push({ result, window });
    }

    let strictest = results[0].result;
    for (const r of results) {
      const rem = 1 - r.result.remaining / r.result.limit;
      const cur = 1 - strictest.remaining / strictest.limit;
      if (rem > cur) {
        strictest = r.result;
      }
    }

    for (const { result, window } of results) {
      const prefix = window.label;
      res.setHeader(`X-RateLimit-Limit-${prefix}`, String(result.limit));
      res.setHeader(`X-RateLimit-Remaining-${prefix}`, String(result.remaining));
      res.setHeader(`X-RateLimit-Reset-${prefix}`, String(Math.ceil(result.resetAt / 1000)));
    }

    res.setHeader('X-RateLimit-Limit', String(strictest.limit));
    res.setHeader('X-RateLimit-Remaining', String(strictest.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(strictest.resetAt / 1000)));
    res.setHeader('X-RateLimit-Tier', tier);
    res.setHeader('X-RateLimit-Cost', String(endpointCost.cost));

    const usagePct = results.map(r => 1 - r.result.remaining / r.result.limit);
    const maxUsage = Math.max(...usagePct);

    if (maxUsage >= 0.95) {
      res.setHeader('X-RateLimit-Warning', 'critical');
      rateLimitWarnings.inc({ tier, scope, level: 'critical' });
      logger.warn('Rate limit critical', { tier, scope, identifier, usage: maxUsage, path });
    } else if (maxUsage >= 0.90) {
      res.setHeader('X-RateLimit-Warning', 'severe');
      rateLimitWarnings.inc({ tier, scope, level: 'severe' });
    } else if (maxUsage >= 0.80) {
      res.setHeader('X-RateLimit-Warning', 'warning');
      rateLimitWarnings.inc({ tier, scope, level: 'warning' });
    }

    if (!strictest.allowed) {
      res.setHeader('Retry-After', String(strictest.retryAfter));
      rateLimitBreaches.inc({ tier, scope, endpoint: path });
      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Retry after ${strictest.retryAfter} seconds.`,
        retryAfter: strictest.retryAfter,
        tier,
        limits: config.windows.map(w => ({
          window: w.label,
          limit: w.max,
          remaining: results.find(r => r.window.label === w.label)!.result.remaining,
          resetAt: Math.ceil(results.find(r => r.window.label === w.label)!.result.resetAt / 1000),
        })),
      });
      return;
    }

    next();
  };
}

export async function getQuotaUsage(
  userId: string,
  tier: string,
  redis?: Redis,
): Promise<QuotaUsage[]> {
  const r = redis || (redisClient as any as Redis);
  const config = TIERS[tier];
  if (!config) return [];

  const now = Date.now();
  const usage: QuotaUsage[] = [];

  for (const window of config.windows) {
    const key = `ratelimit:user:${userId}:${tier}:${window.windowMs}`;
    await r.zremrangebyscore(key, 0, now - window.windowMs);
    const count = await r.zcard(key);
    usage.push({
      window: window.label,
      windowMs: window.windowMs,
      limit: window.max,
      used: count,
      remaining: Math.max(0, window.max - count),
      resetAt: now + window.windowMs,
    });
  }

  return usage;
}
