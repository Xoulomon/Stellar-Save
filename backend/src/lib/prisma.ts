/**
 * Canonical Prisma client singleton.
 *
 * Re-exports the single managed Prisma instance (`prisma`) with read-replica
 * support and the graceful-shutdown helper (`disconnectPrisma`) from
 * `prisma_client.ts`. Import the singleton from this module instead of calling
 * `new PrismaClient()` so the whole service shares one connection pool (#88).
 */
export { prisma, disconnectPrisma } from '../prisma_client';
