import { Router, Request, Response } from 'express';
import * as crypto from 'crypto';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

export function createWebhookRouter(): Router {
  const router = Router();

  // POST /api/webhooks — register a new webhook
  router.post('/', async (req: Request, res: Response) => {
    const { userId, groupId, url, events, secret, description } = req.body;

    if (!userId || !url || !events || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'userId, url, and events[] are required' });
    }

    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

    try {
      const webhook = await (prisma as any).webhook.create({
        data: { userId, groupId: groupId || null, url, events, secret: webhookSecret, description: description || null },
      });
      return res.status(201).json({ ...webhook, secret: webhookSecret });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to create webhook' });
    }
  });

  // GET /api/webhooks?userId=... — list webhooks for a user
  router.get('/', async (req: Request, res: Response) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId query param is required' });

    try {
      const webhooks = await (prisma as any).webhook.findMany({
        where: { userId: userId as string },
        orderBy: { createdAt: 'desc' },
      });
      // Mask secrets in list response
      return res.json(webhooks.map((w: any) => ({ ...w, secret: undefined })));
    } catch {
      return res.status(500).json({ error: 'Failed to fetch webhooks' });
    }
  });

  // GET /api/webhooks/:id — get a single webhook
  router.get('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId } = req.query;

    try {
      const webhook = await (prisma as any).webhook.findFirst({
        where: { id, ...(userId ? { userId: userId as string } : {}) },
      });
      if (!webhook) return res.status(404).json({ error: 'Webhook not found' });
      return res.json({ ...webhook, secret: undefined });
    } catch {
      return res.status(500).json({ error: 'Failed to fetch webhook' });
    }
  });

  // PATCH /api/webhooks/:id — update a webhook
  router.patch('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId, url, events, isActive, description } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const updateData: any = {};
    if (url !== undefined) {
      try { new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
      updateData.url = url;
    }
    if (events !== undefined) updateData.events = events;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (description !== undefined) updateData.description = description;

    try {
      const existing = await (prisma as any).webhook.findFirst({ where: { id, userId } });
      if (!existing) return res.status(404).json({ error: 'Webhook not found' });

      const updated = await (prisma as any).webhook.update({ where: { id }, data: updateData });
      return res.json({ ...updated, secret: undefined });
    } catch {
      return res.status(500).json({ error: 'Failed to update webhook' });
    }
  });

  // DELETE /api/webhooks/:id — delete a webhook
  router.delete('/:id', async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ error: 'userId query param is required' });

    try {
      const existing = await (prisma as any).webhook.findFirst({ where: { id, userId: userId as string } });
      if (!existing) return res.status(404).json({ error: 'Webhook not found' });

      await (prisma as any).webhook.delete({ where: { id } });
      return res.json({ success: true });
    } catch {
      return res.status(500).json({ error: 'Failed to delete webhook' });
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
        const res = await fetch(webhook.url, {
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
          console.error(`Webhook delivery failed for ${webhook.id}: HTTP ${res.status}`);
        }
      } catch (err: any) {
        console.error(`Webhook delivery error for ${webhook.id}: ${err.message}`);
      }
    })
  );
}
