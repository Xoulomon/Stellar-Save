/**
 * NotificationPreference repository (#41).
 *
 * Single owner of all `prisma.notificationPreference.*` access. Previously the
 * same lookups (`findUnique({ where: { userId } })`, digest queries, counts)
 * were duplicated across `user_preference_manager.ts`, `services/notifications.ts`
 * and `privacy_service.ts`.
 */
export interface NotificationPreferenceRow {
  id: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  contributionReminders: boolean;
  groupUpdates: boolean;
  payoutNotifications: boolean;
  emailFrequency: string;
  unsubscribeToken: string;
  [key: string]: unknown;
}

export type EmailFrequency = 'immediate' | 'daily' | 'weekly' | 'never';

export interface NotificationPreferenceCreate {
  userId: string;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  contributionReminders?: boolean;
  groupUpdates?: boolean;
  payoutNotifications?: boolean;
  emailFrequency?: string;
  unsubscribeToken: string;
}

export type NotificationPreferenceUpdate = Partial<
  Omit<NotificationPreferenceCreate, 'userId'>
>;

/** Minimal structural view of the Prisma delegate this repository needs. */
export interface NotificationPreferenceDelegate {
  findUnique(args: {
    where: { userId: string } | { unsubscribeToken: string };
  }): Promise<NotificationPreferenceRow | null>;
  findFirst(args: { where: { userId: string } }): Promise<NotificationPreferenceRow | null>;
  findMany(args: {
    where?: Record<string, unknown>;
    select?: Record<string, boolean>;
  }): Promise<Array<Record<string, unknown>>>;
  create(args: { data: NotificationPreferenceCreate }): Promise<NotificationPreferenceRow>;
  update(args: {
    where: { userId: string } | { id: string };
    data: NotificationPreferenceUpdate;
  }): Promise<NotificationPreferenceRow>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: NotificationPreferenceUpdate;
  }): Promise<{ count: number }>;
  count(args?: { where?: Record<string, unknown> }): Promise<number>;
  groupBy(args: { by: string[]; _count: boolean }): Promise<Array<Record<string, unknown>>>;
}

export interface NotificationPreferencePrisma {
  notificationPreference: NotificationPreferenceDelegate;
}

export class NotificationPreferenceRepository {
  private _db?: NotificationPreferencePrisma;

  /**
   * @param db  Prisma client (or a structural mock in tests). Omit in
   *            production — the shared singleton is resolved lazily on first
   *            use so constructing the repository never forces a DB import.
   */
  constructor(db?: NotificationPreferencePrisma) {
    this._db = db;
  }

  private get db(): NotificationPreferencePrisma {
    if (!this._db) {
      // Lazy require avoids pulling `prisma_client` into unit tests that inject a mock.
      this._db = require('../../prisma_client').prisma as NotificationPreferencePrisma;
    }
    return this._db;
  }

  findByUserId(userId: string): Promise<NotificationPreferenceRow | null> {
    return this.db.notificationPreference.findUnique({ where: { userId } });
  }

  /** `findFirst` variant kept for the privacy export sweep. */
  findFirstByUserId(userId: string): Promise<NotificationPreferenceRow | null> {
    return this.db.notificationPreference.findFirst({ where: { userId } });
  }

  findByUnsubscribeToken(token: string): Promise<NotificationPreferenceRow | null> {
    return this.db.notificationPreference.findUnique({ where: { unsubscribeToken: token } });
  }

  create(data: NotificationPreferenceCreate): Promise<NotificationPreferenceRow> {
    return this.db.notificationPreference.create({ data });
  }

  updateByUserId(
    userId: string,
    data: NotificationPreferenceUpdate,
  ): Promise<NotificationPreferenceRow> {
    return this.db.notificationPreference.update({ where: { userId }, data });
  }

  updateById(id: string, data: NotificationPreferenceUpdate): Promise<NotificationPreferenceRow> {
    return this.db.notificationPreference.update({ where: { id }, data });
  }

  async updateManyByUserIds(
    userIds: string[],
    data: NotificationPreferenceUpdate,
  ): Promise<number> {
    const { count } = await this.db.notificationPreference.updateMany({
      where: { userId: { in: userIds } },
      data,
    });
    return count;
  }

  /** User ids opted in to a digest at the given cadence. */
  async userIdsForDigest(frequency: 'daily' | 'weekly'): Promise<string[]> {
    const rows = await this.db.notificationPreference.findMany({
      where: { emailNotifications: true, emailFrequency: frequency },
      select: { userId: true },
    });
    return rows.map((r) => r.userId as string);
  }

  count(where?: Record<string, unknown>): Promise<number> {
    return this.db.notificationPreference.count(where ? { where } : undefined);
  }

  countByEmailFrequency(): Promise<Array<Record<string, unknown>>> {
    return this.db.notificationPreference.groupBy({ by: ['emailFrequency'], _count: true });
  }
}

/** Shared singleton — import this in services. */
export const notificationPreferenceRepository = new NotificationPreferenceRepository();
