/**
 * Lightweight Express app factory for groups-only integration tests.
 *
 * Wires up only the /api/groups router against an InMemoryGroupsRepository
 * seeded with the supplied groups. No database, no background services.
 *
 * Use this in place of the full buildApp() helper when a test only exercises
 * group-related endpoints and doesn't need Prisma or external dependencies.
 *
 * @example
 * ```ts
 * import { buildGroupApp } from '../helpers/groupApp';
 * import { GroupFixtureFactory } from '../fixtures/groups';
 *
 * const { group } = GroupFixtureFactory.buildGroupWithMembers(4);
 * const app = buildGroupApp([group]);
 * ```
 */

import { createGroupsRouter } from '../../src/routes/groups';
import { GroupsService } from '../../src/services/group/groups.service';
import { InMemoryGroupsRepository } from '../../src/services/group/groups.repository';
import { Group } from '../../src/models';

// Use require so this file does not need @types/express in tsconfig.
// The full app helper (test/helpers/app.ts) already uses Express the same way.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const express = require('express');

/**
 * Returns a minimal Express application with only the groups router mounted
 * at `/api`. The repository is seeded with the provided `groups` array.
 */
export function buildGroupApp(groups: Group[]) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createGroupsRouter(new GroupsService(new InMemoryGroupsRepository(groups)))
  );
  return app;
}
