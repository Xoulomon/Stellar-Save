import { randomBytes } from 'crypto';

import { Router } from 'express';

import { config } from '../config';
import { AppError } from '../lib/errors';
import { parseOffsetParams, paginateArray } from '../lib/pagination';
import { logger } from '../logger';
import { ValidationMiddleware } from '../middleware/validation';
import { groupInvitationSchema } from '../middleware/validation.schemas';
import { notificationService } from '../notification_service';
import { prisma } from '../prisma_client';
import { readinessCheckCache } from '../redis';

import type { V1Services } from './v1';
import type { Request, Response, NextFunction } from 'express';

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

  // Health — v2 adds uptime
  router.get('/health', (_req: Request, res: Response) => {
    res.json(
      migrateV1ToV2({
        status: 'ok',
        version: 'v2',
        uptime: process.uptime(),
      })
    );
  });

  // Ready
  router.get('/ready', async (_req: Request, res: Response) => {
    const start = Date.now();

    const [database, horizon, cache] = await Promise.all([
      services.eventIndexer.readinessCheckDatabase(),
      services.eventIndexer.readinessCheckHorizon(),
      readinessCheckCache(),
    ]);

    const responseTimeMs = Date.now() - start;
    const up = database.up && horizon.up && cache.up;

    res.status(up ? 200 : 503).json(
      migrateV1ToV2({
        status: up ? 'ready' : 'not_ready',
        version: 'v2',
        responseTimeMs,
        dependencies: { database, horizon, cache },
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
  router.post(
    '/groups/:groupId/invite',
    ValidationMiddleware.validateBody(groupInvitationSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { groupId, email } = req.body;

        // Look up the real group so we don't send fabricated data to clients
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const group = await (prisma as any).group.findUnique({
          where: { id: groupId },
          select: { id: true, name: true, creatorId: true },
        });

        if (!group) {
          next(new AppError('GROUP_NOT_FOUND', 'Group not found', 404));
          return;
        }

        // Generate token for join link
        const joinToken = randomBytes(32).toString('hex');

        // Persist invitation in DB
        const db = prisma as unknown as {
          groupInvitation: {
            create: (args: unknown) => Promise<{ id: string }>;
          };
        };
        const invitation = await db.groupInvitation.create({
          data: {
            groupId,
            recipientEmail: email,
            joinToken,
            status: 'sent',
          },
        });

        const frontendUrl = config.urls.frontend;
        const joinLink = `${frontendUrl}/groups/join?token=${joinToken}`;

        const groupName = group.name;
        const creatorUserId = (req as Request & { user?: { id?: string } }).user?.id ?? group.creatorId;

        // Ensure a template exists in the system; use a dedicated template key.
        const templateKey = 'email_group_invitation';
        const subject = 'You are invited to join {{groupName}}';

        const emailData: Record<string, unknown> = {
          userName: email,
          groupName,
          joinLink,
          creatorUserId,
        };

        await notificationService.sendEmail(
          email,
          templateKey,
          emailData,
          subject.replace('{{groupName}}', groupName)
        );

        res.status(201).json(
          migrateV1ToV2({
            invitationId: invitation.id,
            status: 'sent',
            joinLink,
          })
        );
      } catch (err: unknown) {
        logger.error('Failed to send group invitation', {
          error: err instanceof Error ? err.message : String(err),
        });
        next(new AppError('GROUP_INVITATION_FAILED', 'Failed to send invitation', 500));
      }
    }
  );

  // Backup list — v2 uses the shared pagination utility with offset/limit
  router.get('/backup', (req: Request, res: Response, next: NextFunction) => {
    try {
      const pageParams = parseOffsetParams(req.query, { limit: 20 });
      const allJobs = backupService.listJobs();
      const result = paginateArray(allJobs, pageParams);
      res.json(migrateV1ToV2(result));
    } catch (err: unknown) {
      next(err);
    }
  });

  // All other v2 routes are stubs — return 501 with migration hint
  router.use((req: Request, res: Response, next: NextFunction) => {
    next(
      new AppError('NOT_IMPLEMENTED', 'Not implemented in v2 yet', 501, {
        hint: `Try the v1 equivalent: /api/v1${req.path}`,
        apiVersion: 'v2',
      })
    );
  });

  return router;
}
