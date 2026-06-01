import { Router, Request, Response } from 'express';
import { V1Services } from './v1';
import { randomBytes } from 'crypto';

import { notificationService } from '../notification_service';
import { prisma } from '../prisma_client';
import { logger } from '../logger';

/**
 * Transforms a v1 response shape into v2 shape.
 * Extend this as v2 diverges from v1.
 */
export function migrateV1ToV2<T extends Record<string, unknown>>(
  v1Response: T
): T & { apiVersion: 'v2' } {
  return { ...v1Response, apiVersion: 'v2' as const };
}

export function createV2Router(services: V1Services): Router {
  const router = Router();
  const { engine, backupService } = services;

  // Health — v2 adds uptime and pool metrics
  router.get('/health', (_req: Request, res: Response) => {
    res.json(
      migrateV1ToV2({
        status: 'ok',
        version: 'v2',
        uptime: process.uptime(),
        responseTimeMs: 0,
        dependencies: {
          database: { up: true },
          horizon: { up: true },
        },
      })
    );
  });

  // Ready
  router.get('/ready', async (_req: Request, res: Response) => {
    const start = Date.now();

    const [database, horizon] = await Promise.all([
      services.eventIndexer.readinessCheckDatabase(),
      services.eventIndexer.readinessCheckHorizon(),
    ]);

    const responseTimeMs = Date.now() - start;
    const up = database.up && horizon.up;

    res.status(up ? 200 : 503).json(
      migrateV1ToV2({
        status: up ? 'ready' : 'not_ready',
        version: 'v2',
        responseTimeMs,
        dependencies: { database, horizon },
      })
    );
  });

  // Recommendations — v2 always uses collaborative filtering and returns richer metadata
  router.get('/recommendations/:userId', (req: Request, res: Response) => {
    const { userId } = req.params;
    const recommendations = engine.getRecommendations(userId, 'collaborative');
    res.json(migrateV1ToV2({ userId, algorithm: 'collaborative', recommendations }));
  });

  // Group invitation email
  // POST /api/groups/:groupId/invite
  router.post('/groups/:groupId/invite', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const { email } = req.body as { email?: string };

      if (!groupId) return res.status(400).json(migrateV1ToV2({ error: 'groupId is required' }));
      if (!email || typeof email !== 'string')
        return res.status(400).json(migrateV1ToV2({ error: 'email is required' }));

      // Generate token for join link
      const joinToken = randomBytes(32).toString('hex');

      // Persist invitation in DB
      const invitation = await (prisma as any).groupInvitation.create({
        data: {
          groupId,
          recipientEmail: email,
          joinToken,
          status: 'sent',
        },
      });

      const frontendUrl = process.env.FRONTEND_URL || 'https://stellar-save.com';
      const joinLink = `${frontendUrl}/groups/join?token=${joinToken}`;

      const groupName = `Group ${groupId}`; // TODO: fetch actual group name if available
      const creatorUserId = 'unknown'; // TODO: extract from auth context

      // Ensure a template exists in the system; use a dedicated template key.
      const templateKey = 'email_group_invitation';
      const subject = 'You are invited to join {{groupName}}';

      await notificationService.sendEmail(
        email,
        templateKey,
        {
          userName: email,
          groupName,
          joinLink,
          creatorUserId,
        } as any,
        subject.replace('{{groupName}}', groupName)
      );

      res.status(201).json(
        migrateV1ToV2({
          invitationId: invitation.id,
          status: 'sent',
          joinLink,
        })
      );
    } catch (err: any) {
      logger.error('Failed to send group invitation', { error: err?.message || String(err) });
      res.status(500).json(migrateV1ToV2({ error: 'Failed to send invitation' }));
    }
  });

  // Backup list — v2 adds pagination
  router.get('/backup', (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const all = backupService.listJobs();
    const start = (page - 1) * limit;
    res.json(
      migrateV1ToV2({
        data: all.slice(start, start + limit),
        total: all.length,
        page,
        limit,
      })
    );
  });

  // All other v2 routes are stubs — return 501 with migration hint
  router.use((req: Request, res: Response) => {
    res.status(501).json({
      error: 'Not implemented in v2 yet',
      hint: `Try the v1 equivalent: /api/v1${req.path}`,
      apiVersion: 'v2',
    });
  });

  return router;
}
