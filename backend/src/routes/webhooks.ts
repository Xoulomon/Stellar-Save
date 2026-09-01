import * as crypto from 'crypto';

import { Router } from 'express';


import { AppError } from '../lib/errors';
import { fetchWithCorrelationId } from '../lib/http';
import { logger } from '../logger';
import { prisma } from '../prisma_client';

import type { Request, Response, NextFunction } from 'express';

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
      const webhook = await (prisma as any).webhook.create({
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

  // GET /api/webhooks?userId=... — list webhooks for a user
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.query;
    if (!userId) return next(new AppError('MISSING_FIELDS', 'userId query param is required', 400));

    try {
      const webhooks = await (prisma as any).webhook.findMany({
        where: { userId: userId as string },
        orderBy: { createdAt: 'desc' },
      });
      // Mask secrets in list response
      return res.json(webhooks.map((w: any) => ({ ...w, secret: undefined })));
    } catch {
      return next(new AppError('WEBHOOKS_FETCH_FAILED', 'Failed to fetch webhooks', 500));
    }
  });

  // GET /api/webhooks/:id — get a single webhook
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { userId } = req.query;

    try {
      const webhook = await (prisma as any).webhook.findFirst({
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

    const updateData: any = {};
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
      const existing = await (prisma as any).webhook.findFirst({ where: { id, userId } });
      if (!existing) return next(new AppError('WEBHOOK_NOT_FOUND', 'Webhook not found', 404));

      const updated = await (prisma as any).webhook.update({ where: { id }, data: updateData });
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
      const existing = await (prisma as any).webhook.findFirst({
        where: { id, userId: userId as string },
      });
      if (!existing) return next(new AppError('WEBHOOK_NOT_FOUND', 'Webhook not found', 404));

      await (prisma as any).webhook.delete({ where: { id } });
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
  const where: any = { isActive: true, events: { has: event } };
  if (groupId) where.OR = [{ groupId }, { groupId: null }];

  let webhooks: any[];
  try {
    webhooks = await (prisma as any).webhook.findMany({ where });
  } catch {
    return;
  }

  const timestamp = Date.now().toString();
  const body = JSON.stringify({ event, timestamp, data: payload });

  await Promise.allSettled(
    webhooks.map(async (webhook: any) => {
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
      } catch (err: any) {
        logger.error(`Webhook delivery error for ${webhook.id}: ${err.message}`);
      }
    })
  );
}
