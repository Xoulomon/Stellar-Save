import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from './api_key_service';
import { logger } from './logger';

const keyUsageCounts = new Map<string, { count: number; resetAt: number }>();

export async function apiKeyAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'] as string;

  if (!key) {
    return res.status(401).json({ error: 'x-api-key header is required' });
  }

  const validation = await apiKeyService.validateKey(key);
  if (!validation.valid) {
    return res.status(403).json({ error: 'Invalid or expired API key' });
  }

  const now = Date.now();
  const usage = keyUsageCounts.get(validation.keyId!) || { count: 0, resetAt: now + 60 * 1000 };

  if (now > usage.resetAt) {
    usage.count = 0;
    usage.resetAt = now + 60 * 1000;
  }

  usage.count++;

  if (usage.count > validation.rateLimit!) {
    logger.warn('API rate limit exceeded', { keyId: validation.keyId });
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  keyUsageCounts.set(validation.keyId!, usage);

  (req as any).apiKey = { keyId: validation.keyId, userId: validation.userId };
  next();
}

export async function recordApiUsage(req: Request, res: Response) {
  if ((req as any).apiKey) {
    const statusCode = res.statusCode || 200;
    await apiKeyService.recordUsage((req as any).apiKey.keyId, req.path, req.method, statusCode);
  }
}
