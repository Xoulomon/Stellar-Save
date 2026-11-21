/**
 * Canonical Prisma client singleton.
 *
 * Re-exports the single managed Prisma instance (`prisma`) with read-replica
 * support and the graceful-shutdown helper (`disconnectPrisma`) from
 * `prisma_client.ts`. Import the singleton from this module instead of calling
 * `new PrismaClient()` so the whole service shares one connection pool (#88).
 *
 * Also exposes batching helpers used by group/member lookups to avoid N+1
 * queries (#2070). These helpers always operate on the canonical singleton so
 * that batched reads share the same connection pool and read-replica routing.
 */
import { prisma } from '../prisma_client';

export { prisma, disconnectPrisma } from '../prisma_client';

/**
 * Maximum number of ids accepted by a single batched lookup. Keeps generated
 * `IN (...)` clauses within safe bounds for the underlying database drivers.
 */
export const MAX_BATCH_SIZE = 1000;

/**
 * Splits an array into chunks of at most `size` elements.
 *
 * @param items - The items to chunk.
 * @param size - Maximum chunk size (defaults to {@link MAX_BATCH_SIZE}).
 * @returns An array of chunks; empty input yields an empty array.
 */
export function chunk<T>(items: readonly T[], size: number = MAX_BATCH_SIZE): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new RangeError(`chunk size must be a positive integer, received: ${size}`);
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Deduplicates and filters out nullish/empty ids before a batched lookup.
 *
 * @param ids - Raw ids that may contain duplicates or nullish values.
 * @returns A de-duplicated array of non-empty string ids.
 */
export function normalizeIds(ids: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

/**
 * Runs a batched `findMany`-style lookup against the canonical Prisma client,
 * chunking ids to avoid oversized `IN (...)` clauses and N+1 query patterns.
 *
 * The `findMany` callback receives each chunk of ids and must return the rows
 * for that chunk. Results from all chunks are concatenated in order.
 *
 * @param ids - Raw ids to look up (duplicates/nullish values are removed).
 * @param findMany - Callback performing the lookup for a single chunk.
 * @param size - Maximum chunk size (defaults to {@link MAX_BATCH_SIZE}).
 * @returns The concatenated rows for all chunks.
 */
export async function batchFindMany<T, R>(
  ids: readonly (string | null | undefined)[],
  findMany: (chunkIds: string[]) => Promise<R[]>,
  size: number = MAX_BATCH_SIZE,
): Promise<R[]> {
  const normalized = normalizeIds(ids);
  if (normalized.length === 0) return [];

  const results: R[] = [];
  for (const chunkIds of chunk(normalized, size)) {
    const rows = await findMany(chunkIds);
    results.push(...rows);
  }
  return results;
}

/**
 * Returns the canonical Prisma client. Provided so callers can obtain the
 * singleton through a function (useful for dependency injection in tests)
 * while still sharing the single connection pool.
 */
export function getPrismaClient() {
  return prisma;
}