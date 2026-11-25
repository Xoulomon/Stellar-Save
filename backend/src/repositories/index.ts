import type { PrismaClient } from '@prisma/client';

/**
 * Repository layer over Prisma.
 *
 * Repositories wrap a `PrismaClient` instance and expose narrow, typed data
 * access methods so callers do not depend on Prisma directly. This keeps
 * boundaries clear and makes the data layer easy to mock in unit tests.
 */
export interface Repository {
  readonly client: PrismaClient;
}

/**
 * Base repository providing shared access to the underlying Prisma client.
 * Concrete repositories extend this class and add domain-specific methods.
 */
export abstract class BaseRepository implements Repository {
  constructor(readonly client: PrismaClient) {}
}

/**
 * Minimal user repository. Backwards compatible: existing callers that use
 * `prisma.user` directly keep working, while new code can depend on this
 * repository instead.
 */
export class UserRepository extends BaseRepository {
  findById(id: string) {
    return this.client.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.client.user.findUnique({ where: { email } });
  }

  create(data: { email: string; name?: string | null }) {
    return this.client.user.create({ data });
  }
}

/**
 * Factory that builds the repository bundle from a single Prisma client.
 * Callers can keep constructing their own `PrismaClient` and pass it in,
 * preserving existing behavior.
 */
export interface Repositories {
  user: UserRepository;
}

export function createRepositories(client: PrismaClient): Repositories {
  return {
    user: new UserRepository(client),
  };
}
