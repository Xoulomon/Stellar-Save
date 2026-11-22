import { Router } from 'express';

import { createAdminRouter } from './admin';
import { createBackupsRouter } from './backups';
import { createExportsRouter } from './exports';
import { createGroupsRouter } from './groups';
import { createPayoutsRouter } from './payouts';
import { createSystemRouter } from './system';
import { createGovernanceRouter } from '../governance';
import { createInsuranceRouter } from '../insurance';
import { createNotificationRouter } from '../notifications';
import { createSseRouter } from '../sse';

import type { V1Services } from '../v1';

/**
 * Mounts every per-resource v1 router with the same paths and ordering that
 * previously lived inline in `routes/v1.ts`. Ordering matters: keep the
 * `router.use(...)` calls in the same sequence as the original file.
 */
export function createV1Router(services: V1Services): Router {
  const router = Router();

  // Notifications (web push subscriptions, preferences, templates)
  router.use('/notifications', createNotificationRouter());

  // SSE event stream (Issue #1011)
  router.use('/events', createSseRouter(services.eventIndexer));

  // Insurance pool (Issue #1012)
  router.use('/groups/:groupId/insurance', createInsuranceRouter());

  // Governance proposals (Issue #1013)
  router.use('/governance', createGovernanceRouter());

  // System: landing stats, search, preferences, recommendations, health, ready
  router.use('/', createSystemRouter(services));

  // Exports
  router.use('/', createExportsRouter(services));

  // Backups
  router.use('/', createBackupsRouter(services));

  // Payouts
  router.use('/', createPayoutsRouter(services));

  // Groups
  router.use('/', createGroupsRouter(services));

  // Admin actions
  router.use('/', createAdminRouter(services));

  return router;
}
