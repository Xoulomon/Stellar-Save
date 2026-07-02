import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { logger } from './logger';
import { Gauge } from 'prom-client';
import { registry } from './metrics';

// ── Connection-count metric ───────────────────────────────────────────────────
const prismaConnectionsTotal = new Gauge({
  name: 'prisma_connections_total',
  help: 'Number of active Prisma client connections (1 primary + 1 replica when configured)',
  registers: [registry],
});

// ── Managed Prisma provider with read-replica support ────────────────────────
class PrismaReadReplicaClient {
  private primaryClient: PrismaClient;
  private replicaClient?: PrismaClient;
  private replicaHealthy = true;

  constructor() {
    this.primaryClient = new PrismaClient({
      datasources: { db: { url: config.database.url } },
    });
    prismaConnectionsTotal.inc();

    if (config.database.replicaUrl) {
      this.replicaClient = new PrismaClient({
        datasources: { db: { url: config.database.replicaUrl } },
      });
      prismaConnectionsTotal.inc();
      logger.info('Read replica configured', { replicaUrl: config.database.replicaUrl });
    }
  }

  getClient(isWrite = false): PrismaClient {
    if (isWrite || !this.replicaHealthy || !this.replicaClient) {
      return this.primaryClient;
    }
    return this.replicaClient;
  }

  async disconnect(): Promise<void> {
    await this.primaryClient.$disconnect();
    prismaConnectionsTotal.dec();
    if (this.replicaClient) {
      await this.replicaClient.$disconnect();
      prismaConnectionsTotal.dec();
    }
  }
}

const prismaSingleton = new PrismaReadReplicaClient();

/** Single managed Prisma instance — import this everywhere instead of `new PrismaClient()`. */
export const prisma = new Proxy(prismaSingleton.getClient(), {
  get: (target: any, prop: string) => {
    if (typeof target[prop] === 'function') {
      const isWrite =
        ['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany'].some(
          (m) => prop.endsWith(m)
        );
      const client = prismaSingleton.getClient(isWrite);
      return (client as any)[prop]?.bind(client);
    }
    return target[prop];
  },
}) as PrismaClient;

/** Call on process shutdown to gracefully close all DB connections. */
export async function disconnectPrisma(): Promise<void> {
  await prismaSingleton.disconnect();
}
