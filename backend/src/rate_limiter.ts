import { NextFunction, Request, Response } from 'express';

export interface RateLimitPolicy {
    windowMs: number;
    max: number;
}

export interface RateLimiterOptions {
    ipPolicy?: RateLimitPolicy;
    userPolicy?: RateLimitPolicy;
    now?: () => number;
}

export interface AuthenticatedRateLimitRequest extends Request {
    adminId?: string;
    userId?: string;
    user?: { id?: string };
}

interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetAtMs: number;
    retryAfterSeconds: number;
}

class SlidingWindowStore {
    private readonly store = new Map<string, number[]>();

    take(key: string, policy: RateLimitPolicy, nowMs: number): RateLimitResult {
        const cutoff = nowMs - policy.windowMs;
        const current = (this.store.get(key) ?? []).filter(ts => ts > cutoff);

        if (current.length >= policy.max) {
            const resetAtMs = (current[0] ?? nowMs) + policy.windowMs;
            this.store.set(key, current);
            return {
                allowed: false,
                limit: policy.max,
                remaining: 0,
                resetAtMs,
                retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - nowMs) / 1000)),
            };
        }

        current.push(nowMs);
        this.store.set(key, current);

        const resetAtMs = (current[0] ?? nowMs) + policy.windowMs;
        return {
            allowed: true,
            limit: policy.max,
            remaining: Math.max(0, policy.max - current.length),
            resetAtMs,
            retryAfterSeconds: Math.max(0, Math.ceil((resetAtMs - nowMs) / 1000)),
        };
    }
}

function readHeaderValue(value: string | string[] | undefined): string | undefined {
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (Array.isArray(value) && value[0]?.trim()) return value[0].trim();
    return undefined;
}

function extractUserId(req: AuthenticatedRateLimitRequest): string | undefined {
    const explicitUserId = req.userId || req.adminId || req.user?.id;
    if (explicitUserId) return explicitUserId;
    return readHeaderValue(req.headers['x-user-id']);
}

function isAuthenticated(req: AuthenticatedRateLimitRequest): boolean {
    if (Boolean(req.adminId || req.userId || req.user?.id)) return true;
    return Boolean(readHeaderValue(req.headers.authorization));
}

function extractIp(req: Request): string {
    const forwarded = readHeaderValue(req.headers['x-forwarded-for']);
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.ip || req.socket?.remoteAddress || 'unknown';
}

function applyRateLimitHeaders(res: Response, result: RateLimitResult): void {
    res.setHeader('X-RateLimit-Limit', String(result.limit));
    res.setHeader('X-RateLimit-Remaining', String(result.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetAtMs / 1000)));
}

/**
 * Sliding-window rate limiter.
 * - Unauthenticated traffic: per-IP limits.
 * - Authenticated traffic with user id: per-user limits (bypasses IP bucket).
 * - Authenticated traffic without user id: bypassed.
 */
export function createRateLimiterMiddleware(options: RateLimiterOptions = {}) {
    const now = options.now ?? (() => Date.now());
    const ipPolicy: RateLimitPolicy = options.ipPolicy ?? { windowMs: 60_000, max: 100 };
    const userPolicy: RateLimitPolicy = options.userPolicy ?? { windowMs: 60_000, max: 200 };
    const store = new SlidingWindowStore();

    return (req: AuthenticatedRateLimitRequest, res: Response, next: NextFunction): void => {
        const nowMs = now();
        const userId = extractUserId(req);
        const authenticated = isAuthenticated(req);

        if (authenticated && !userId) {
            next();
            return;
        }

        const key = userId && authenticated ? `user:${userId}` : `ip:${extractIp(req)}`;
        const policy = userId && authenticated ? userPolicy : ipPolicy;
        const result = store.take(key, policy, nowMs);

        applyRateLimitHeaders(res, result);

        if (!result.allowed) {
            res.setHeader('Retry-After', String(result.retryAfterSeconds));
            res.status(429).json({ error: 'Too many requests' });
            return;
        }

        next();
    };
}
