/**
 * Shared database setup and teardown helpers for all tests.
 * Consolidates duplicate setup/teardown logic from unit and integration tests.
 *
 * Usage:
 *   import { setupDb, teardownDb, seedFixtures } from '../helpers/db';
 *
 *   beforeAll(async () => {
 *     await setupDb();
 *     await seedFixtures({ users: 5, groups: 3 });
 *   });
 *
 *   afterAll(async () => {
 *     await teardownDb();
 *   });
 */

import { PrismaClient } from '../../src/generated/prisma';

let prismaInstance: PrismaClient | null = null;

/**
 * Get or create a Prisma client instance (singleton).
 * All tests share the same connection pool.
 */
export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prismaInstance;
}

/**
 * Initialize database connection and verify it's accessible.
 * Call this in beforeAll() hook.
 */
export async function setupDb(): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.$connect();
    console.log('✓ Database connection established');
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from database and clean up resources.
 * Call this in afterAll() hook.
 */
export async function teardownDb(): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.$disconnect();
    prismaInstance = null;
    console.log('✓ Database connection closed');
  } catch (error) {
    console.error('✗ Database disconnection failed:', error);
    throw error;
  }
}

/**
 * Clean all tables in the database.
 * Call this between tests or in afterEach() for isolation.
 * WARNING: Destructive operation — only use in test databases.
 */
export async function cleanDatabase(): Promise<void> {
  const prisma = getPrisma();
  const tables = [
    'notification_queue',
    'notification',
    'notification_template',
    'notification_preference',
    'contract_event',
    'platform_metrics',
    'user_metrics',
    'group_metrics',
    'analytics_event',
    'analytics_report',
    'indexed_transaction',
    'push_subscription',
    'soroban_event_cursor',
    'webhook',
    'audit_log',
    'audit_event_log',
    'privacy_request',
    'refresh_token',
    'member_reputation',
    'mobile_device_token',
    'fraud_flag',
    'api_key',
    'api_key_usage',
    'kyc_record',
    'kyc_status_event',
    'ramp_transaction',
  ];

  try {
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
    }
    console.log(`✓ Cleaned ${tables.length} tables`);
  } catch (error) {
    console.error('✗ Database cleanup failed:', error);
    throw error;
  }
}

/**
 * Seed common test fixtures.
 * Returns the created records for use in tests.
 */
export async function seedFixtures(options: {
  users?: number;
  groups?: number;
  metrics?: boolean;
} = {}): Promise<any> {
  const prisma = getPrisma();
  const fixtures: any = {};

  const { users = 0, groups = 0, metrics = false } = options;

  if (metrics && users > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    fixtures.platformMetrics = await prisma.platformMetrics.upsert({
      where: { date: today },
      create: {
        date: today,
        totalUsers: users,
        activeUsers: Math.ceil(users * 0.6),
        totalGroups: groups,
        activeGroups: Math.ceil(groups * 0.8),
        totalContributions: users * groups,
        totalContributionAmount: users * groups * 100,
        totalPayouts: Math.ceil(users * groups * 0.5),
        totalPayoutAmount: Math.ceil(users * groups * 50),
        averageGroupSize: Math.ceil(users / Math.max(1, groups)),
        successRate: 75,
        totalTransactions: users * groups * 2,
        uniqueWallets: users,
      },
      update: {},
    });

    console.log(`✓ Seeded platform metrics: ${users} users, ${groups} groups`);
  }

  return fixtures;
}

/**
 * Create a test transaction and related records.
 */
export async function createTestTransaction(data: {
  userId: string;
  groupId: string;
  type: 'contribution' | 'payout';
  amount: number;
}) {
  const prisma = getPrisma();

  const transaction = await prisma.indexedTransaction.create({
    data: {
      txHash: `txhash-${Date.now()}`,
      ledgerSeq: Math.floor(Math.random() * 1000000),
      sourceAccount: `account-${data.userId}`,
      feePaid: 100,
      operationCount: 1,
      pagingToken: `${Date.now()}-0`,
      createdAt: new Date(),
    },
  });

  return transaction;
}

/**
 * Assert that a database record exists with the given criteria.
 */
export async function assertDbRecordExists(
  model: keyof PrismaClient,
  where: any
): Promise<void> {
  const prisma = getPrisma();
  const record = await (prisma as any)[model].findFirst({ where });
  if (!record) {
    throw new Error(`Expected record not found in ${String(model)}: ${JSON.stringify(where)}`);
  }
}

/**
 * Assert that a database record does NOT exist.
 */
export async function assertDbRecordNotExists(
  model: keyof PrismaClient,
  where: any
): Promise<void> {
  const prisma = getPrisma();
  const record = await (prisma as any)[model].findFirst({ where });
  if (record) {
    throw new Error(`Unexpected record found in ${String(model)}: ${JSON.stringify(where)}`);
  }
}
