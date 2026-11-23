import { Gauge } from 'prom-client';

import { config } from './config';
import { PrismaClient } from './generated/prisma/client';
import { logger } from './logger';
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
  get: (target: PrismaClient, prop: string) => {
    if (typeof (target as unknown as Record<string, unknown>)[prop] === 'function') {
      const isWrite = [
        'create',
        'update',
        'delete',
        'upsert',
        'createMany',
        'updateMany',
        'deleteMany',
      ].some((m) => prop.endsWith(m));
      const client = prismaSingleton.getClient(isWrite);
      return (client as unknown as Record<string, unknown>)[prop];
    }
    return (target as unknown as Record<string, unknown>)[prop];
  },
}) as PrismaClient;

/** Call on process shutdown to gracefully close all DB connections. */
export async function disconnectPrisma(): Promise<void> {
  await prismaSingleton.disconnect();
}

// ── Repository layer over Prisma ─────────────────────────────────────────────
//
// Before: callers reached into the raw `prisma` proxy directly, duplicating
// read/write routing decisions and scattering query construction across the
// codebase. After: a thin repository layer centralises client selection and
// exposes typed, intention-revealing methods. The `prisma` export above is
// preserved unchanged for backwards compatibility.

/** Minimal delegate surface shared by every Prisma model delegate. */
export interface PrismaDelegate<T> {
  findUnique(args: unknown): Promise<T | null>;
  findMany(args?: unknown): Promise<T[]>;
  create(args: unknown): Promise<T>;
  update(args: unknown): Promise<T>;
  delete(args: unknown): Promise<T>;
}

/**
 * Generic repository wrapping a single Prisma model delegate.
 * Reads are routed to the replica when healthy; writes always hit the primary.
 */
export class PrismaRepository<T> {
  constructor(private readonly delegateName: string) {}

  private delegate(isWrite: boolean): PrismaDelegate<T> {
    const client = prismaSingleton.getClient(isWrite) as unknown as Record<
      string,
      PrismaDelegate<T>
    >;
    const delegate = client[this.delegateName];
    if (!delegate) {
      throw new Error(`Unknown Prisma delegate: ${this.delegateName}`);
    }
    return delegate;
  }

  findUnique(args: unknown): Promise<T | null> {
    return this.delegate(false).findUnique(args);
  }

  findMany(args?: unknown): Promise<T[]> {
    return this.delegate(false).findMany(args);
  }

  create(args: unknown): Promise<T> {
    return this.delegate(true).create(args);
  }

  update(args: unknown): Promise<T> {
    return this.delegate(true).update(args);
  }

  delete(args: unknown): Promise<T> {
    return this.delegate(true).delete(args);
  }
}

/** Factory for building a repository bound to a named Prisma model delegate. */
export function createRepository<T>(delegateName: string): PrismaRepository<T> {
  return new PrismaRepository<T>(delegateName);
}
