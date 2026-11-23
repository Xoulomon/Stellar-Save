import { PrismaClient } from '@prisma/client';

/**
 * Minimal delegate surface shared by every Prisma model delegate.
 * Kept intentionally small so repositories can be unit-tested with a
 * lightweight fake instead of a real PrismaClient.
 */
export interface PrismaDelegate<TModel, TCreate, TUpdate, TWhere, TOrderBy> {
  findUnique(args: { where: TWhere }): Promise<TModel | null>;
  findMany(args?: {
    where?: TWhere;
    orderBy?: TOrderBy;
    skip?: number;
    take?: number;
  }): Promise<TModel[]>;
  create(args: { data: TCreate }): Promise<TModel>;
  update(args: { where: TWhere; data: TUpdate }): Promise<TModel>;
  delete(args: { where: TWhere }): Promise<TModel>;
  count(args?: { where?: TWhere }): Promise<number>;
}

/**
 * Base repository that wraps a single Prisma model delegate.
 *
 * Concrete repositories extend this class and pass the delegate from the
 * shared PrismaClient, so callers keep using the same client while data
 * access is centralized behind a stable, testable boundary.
 */
export abstract class BaseRepository<TModel, TCreate, TUpdate, TWhere, TOrderBy> {
  protected constructor(
    protected readonly delegate: PrismaDelegate<TModel, TCreate, TUpdate, TWhere, TOrderBy>,
  ) {}

  findById(where: TWhere): Promise<TModel | null> {
    return this.delegate.findUnique({ where });
  }

  findMany(args?: {
    where?: TWhere;
    orderBy?: TOrderBy;
    skip?: number;
    take?: number;
  }): Promise<TModel[]> {
    return this.delegate.findMany(args);
  }

  create(data: TCreate): Promise<TModel> {
    return this.delegate.create({ data });
  }

  update(where: TWhere, data: TUpdate): Promise<TModel> {
    return this.delegate.update({ where, data });
  }

  delete(where: TWhere): Promise<TModel> {
    return this.delegate.delete({ where });
  }

  count(where?: TWhere): Promise<number> {
    return this.delegate.count(where ? { where } : undefined);
  }
}

/**
 * Resolves a Prisma model delegate from a client instance.
 * Throws a clear error when the model is missing so misconfiguration
 * surfaces early instead of failing with an opaque `undefined` access.
 */
export function getDelegate<TDelegate>(
  client: PrismaClient,
  model: keyof PrismaClient,
): TDelegate {
  const delegate = client[model] as unknown as TDelegate | undefined;
  if (!delegate) {
    throw new Error(`Prisma model delegate not found: ${String(model)}`);
  }
  return delegate;
}
