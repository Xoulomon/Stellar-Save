import * as crypto from 'crypto';

import { Router } from 'express';

import { AppError } from '../lib/errors';
import { fetchWithCorrelationId } from '../lib/http';
import { parseOffsetParams, paginateArray } from '../lib/pagination';
import { logger } from '../logger';
import { prisma } from '../prisma_client';

import type { Request, Response, NextFunction } from 'express';

interface WebhookItem {
  id: string;
  userId: string;
  groupId?: string | null;
  url: string;
  events: string[];
  secret: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
}

interface WebhookDb {
  webhook: {
    create: (args: unknown) => Promise<WebhookItem>;
    findMany: (args: unknown) => Promise<WebhookItem[]>;
    findFirst: (args: unknown) => Promise<WebhookItem | null>;
    update: (args: unknown) => Promise<WebhookItem>;
    delete: (args: unknown) => Promise<unknown>;
  };
}

const webhookDb = prisma as unknown as WebhookDb;

export function createWebhookRouter(): Router {
  const router = Router();

  // POST /api/webhooks — register a new webhook
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    const { userId, groupId, url, events, secret, description } = req.body;

    if (!userId || !url || !events || !Array.isArray(events) || events.length === 0) {
      return next(new AppError('MISSING_FIELDS', 'userId, url, and events[] are required', 400));
    }

    try {
      new URL(url);
    } catch {
      return next(new AppError('INVALID_URL', 'Invalid URL', 400));
    }

    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    try {
      const webhook = await webhookDb.webhook.create({
        data: {
          userId,
          groupId: groupId || null,
          url,
          events,
          secret: webhookSecret,
          description: description || null,
        },
      });
      return res.status(201).json({ ...webhook, secret: webhookSecret });
    } catch {
      return next(new AppError('WEBHOOK_CREATE_FAILED', 'Failed to create webhook', 500));
    }
  });

  // GET /api/webhooks?userId=...&page=...&pageSize=... — list webhooks for a user
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.query;
    if (!userId) return next(new AppError('MISSING_FIELDS', 'userId query param is required', 400));

    let pagination: { page: number; pageSize: number; skip: number; take: number };
    try {
      pagination = parseOffsetParams(req.query as Record<string, unknown>);
    } catch (err: unknown) {
      return next(err);
    }

    try {
      const webhooks = await webhookDb.webhook.findMany({
        where: { userId: userId as string },
        orderBy: { createdAt: 'desc' },
      });
      // Mask secrets in list response
      const masked = webhooks.map((w: WebhookItem) => ({ ...w, secret: undefined }));
      return res.json(paginateArray(masked, pagination));
    } catch {
      return next(new AppError('WEBHOOKS_FETCH_FAILED', 'Failed to fetch webhooks', 500));
    }
  });

  // GET /api/webhooks/:id — get a single webhook
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { userId } = req.query;

    try {
      const webhook = await webhookDb.webhook.findFirst({
        where: { id, ...(userId ? { userId: userId as string } : {}) },
      });
      if (!webhook) return next(new AppError('WEBHOOK_NOT_FOUND', 'Webhook not found', 404));
      return res.json({ ...webhook, secret: undefined });
    } catch {
      return next(new AppError('WEBHOOK_FETCH_FAILED', 'Failed to fetch webhook', 500));
    }
  });

  // PATCH /api/webhooks/:id — update a webhook
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { userId, url, events, isActive, description } = req.body;

    if (!userId) return next(new AppError('MISSING_FIELDS', 'userId is required', 400));

    const updateData: Record<string, unknown> = {};
    if (url !== undefined) {
      try {
        new URL(url);
      } catch {
        return next(new AppError('INVALID_URL', 'Invalid URL', 400));
      }
      updateData.url = url;
    }
    if (events !== undefined) updateData.events = events;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (description !== undefined) updateData.description = description;

    try {
      const existing = await webhookDb.webhook.findFirst({ where: { id, userId } });
      if (!existing) return next(new AppError('WEBHOOK_NOT_FOUND', 'Webhook not found', 404));

      const updated = await webhookDb.webhook.update({ where: { id }, data: updateData });
      return res.json({ ...updated, secret: undefined });
    } catch {
      return next(new AppError('WEBHOOK_UPDATE_FAILED', 'Failed to update webhook', 500));
    }
  });

  // DELETE /api/webhooks/:id — delete a webhook
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) return next(new AppError('MISSING_FIELDS', 'userId query param is required', 400));

    try {
      const existing = await webhookDb.webhook.findFirst({
        where: { id, userId: userId as string },
      });
      if (!existing) return next(new AppError('WEBHOOK_NOT_FOUND', 'Webhook not found', 404));

      await webhookDb.webhook.delete({ where: { id } });
      return res.json({ success: true });
    } catch {
      return next(new AppError('WEBHOOK_DELETE_FAILED', 'Failed to delete webhook', 500));
    }
  });

  return router;
}

/**
 * Deliver a signed webhook payload to all active webhooks subscribed to the event.
 * Signs with HMAC-SHA256: X-Webhook-Signature: sha256=<hex>
 */
export async function deliverWebhookEvent(
  event: string,
  payload: Record<string, unknown>,
  groupId?: string
): Promise<void> {
  const where: Record<string, unknown> = { isActive: true, events: { has: event } };
  if (groupId) where.OR = [{ groupId }, { groupId: null }];

  let webhooks: WebhookItem[];
  try {
    webhooks = await webhookDb.webhook.findMany({ where });
  } catch {
    return;
  }

  const timestamp = Date.now().toString();
  const body = JSON.stringify({ event, timestamp, data: payload });

  await Promise.allSettled(
    webhooks.map(async (webhook: WebhookItem) => {
      const sig = crypto
        .createHmac('sha256', webhook.secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

      try {
        const res = await fetchWithCorrelationId(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${sig}`,
            'X-Webhook-Timestamp': timestamp,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) {
          logger.error(`Webhook delivery failed for ${webhook.id}: HTTP ${res.status}`);
        }
      } catch (err: unknown) {
        logger.error(
          `Webhook delivery error for ${webhook.id}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    })
  );
}
