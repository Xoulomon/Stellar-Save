import { PrismaClient } from '@prisma/client';
import { config } from './config';
import { logger } from './logger';

// Centralized Prisma client for the backend with read replica support.
// Routes read-heavy queries to replicas when available; falls back to primary on errors.
class PrismaReadReplicaClient {
  private primaryClient: PrismaClient;
  private replicaClient?: PrismaClient;
  private replicaHealthy = true;

  constructor() {
    this.primaryClient = new PrismaClient({
      datasources: { db: { url: config.database.url } },
    });

    // Initialize replica client if configured
    if (config.database.replicaUrl) {
      this.replicaClient = new PrismaClient({
        datasources: { db: { url: config.database.replicaUrl } },
      });
      logger.info('Read replica configured', { replicaUrl: config.database.replicaUrl });
    }
  }

  // Use replica for reads if healthy, fall back to primary
  private async queryWithFallback<T>(
    replicaQuery: () => Promise<T>,
    primaryQuery: () => Promise<T>
  ): Promise<T> {
    if (this.replicaHealthy && this.replicaClient) {
      try {
        return await replicaQuery();
      } catch (error) {
        logger.warn('Read replica query failed, using primary', { error: String(error) });
        this.replicaHealthy = false;
        // Retry health after 30 seconds
        setTimeout(() => (this.replicaHealthy = true), 30000);
      }
    }
    return await primaryQuery();
  }

  // Get the appropriate client for a query (read or write)
  getClient(isWrite = false) {
    if (isWrite || !this.replicaHealthy || !this.replicaClient) {
      return this.primaryClient;
    }
    return this.replicaClient;
  }
}

const prismaSingleton = new PrismaReadReplicaClient();

// Export a proxy that routes reads to replicas
export const prisma = new Proxy(prismaSingleton.primaryClient, {
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
}) as any;
