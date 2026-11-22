import { afterAll, beforeAll } from '@jest/globals';

import { applyMigrations, resetDatabase } from './integrationDatabase';
import { disconnectPrisma } from '../../src/prisma_client';

beforeAll(async () => {
  applyMigrations();
  await resetDatabase();
}, 60_000);

afterAll(async () => {
  await disconnectPrisma();
});
