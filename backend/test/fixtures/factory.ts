/**
 * @file factory.ts
 * @description Central fixture factory for the Stellar-Save backend test suite.
 *
 * Provides hand-rolled builders for every major domain model used in unit and
 * integration tests.  Every builder is:
 *
 *   - **Pure** — no I/O, no network, no global state.
 *   - **Deterministic** — given the same index / overrides, the output is
 *     always identical.
 *   - **Composable** — each builder accepts a partial override object so tests
 *     only specify what matters for a given scenario.
 *
 * ## Domain coverage
 *
 * | Factory export           | Domain models covered                            |
 * |--------------------------|--------------------------------------------------|
 * | `GroupFactory`           | `Group`, `Member`, `Transaction`, `UserInteraction`, `UserPreference` |
 * | `BackupFactory`          | `BackupJob`, `BackupAlert`, mock S3 client       |
 * | `NotificationFactory`    | `NotificationPreference`, `NotificationTemplate`, `Notification` |
 * | `AnalyticsFactory`       | `PlatformMetrics`, `UserMetrics`, `GroupMetrics`, `AnalyticsEvent` |
 * | `AuditFactory`           | `AuditLog`                                       |
 * | `ReputationFactory`      | Member reputation records                        |
 * | `ServiceMockFactory`     | Typed Express/service mocks reused across suites |
 *
 * ## Quick-start
 *
 * ```ts
 * import {
 *   GroupFactory,
 *   BackupFactory,
 *   NotificationFactory,
 *   AnalyticsFactory,
 * } from '../fixtures/factory';
 *
 * // Single group with defaults
 * const group = GroupFactory.buildGroup();
 *
 * // Three distinct groups
 * const groups = GroupFactory.buildGroupList(3);
 *
 * // Fully-contributed snapshot (triggers payout logic)
 * const { group, members, transactions } =
 *   GroupFactory.buildGroupWithMembers(5, { contributionAmount: 200 });
 *
 * // Mid-cycle: 4 of 6 members have paid
 * const { contributionStates } =
 *   GroupFactory.buildMixedContributionGroup(6, 4);
 *
 * // Near-payout: one member away from triggering cycle completion
 * const { contributionStates } = GroupFactory.buildNearPayoutGroup(5);
 *
 * // Completed group (all payouts distributed)
 * const { group, transactions } = GroupFactory.buildCompletedGroup(4);
 *
 * // Backup fixtures
 * const s3 = BackupFactory.makeMockS3();
 * const job = BackupFactory.buildBackupJob({ type: 'full', status: 'completed' });
 *
 * // Notification fixtures
 * const pref = NotificationFactory.buildPreference('user-42');
 * const tmpl = NotificationFactory.buildTemplate('email_contribution_reminder');
 *
 * // Analytics fixtures
 * const metrics = AnalyticsFactory.buildPlatformMetrics();
 * const userMetrics = AnalyticsFactory.buildUserMetrics('user-1');
 * ```
 *
 * See `backend/test/fixtures/README.md` for the full usage guide.
 */

import crypto from 'crypto';

import type { Group, Member, Transaction, UserInteraction, UserPreference, BackupJob, BackupAlert } from '../../src/models';
import type { S3Client } from '../../src/backup_service';

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Zero-padded sequential counter scoped to a prefix. */
function makeSeq(prefix: string) {
  let n = 0;
  return () => `${prefix}${String(++n).padStart(3, '0')}`;
}

/**
 * Stable deterministic Stellar-like public key derived from a seed string.
 * Produces a 56-char G… address for legible test output.
 */
function stellarAddress(seed: string): string {
  const padded = seed
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, 'X')
    .padEnd(54, 'X');
  return `G${padded.slice(0, 54)}`;
}

/** Deterministic UUID-like string for test IDs (not cryptographically random). */
function testId(prefix: string, seed: string | number): string {
  const hash = crypto
    .createHash('md5')
    .update(`${prefix}-${seed}`)
    .digest('hex');
  return `${prefix}-${hash.slice(0, 8)}`;
}

// ─── GroupFactory ─────────────────────────────────────────────────────────────

export interface MemberContributionState {
  member: Member;
  hasContributed: boolean;
  transaction?: Transaction;
}

export interface GroupFixture {
  group: Group;
  members: Member[];
  transactions: Transaction[];
  contributionStates: MemberContributionState[];
}

/**
 * Factory for Groups, Members, Transactions, UserInteractions, and
 * UserPreferences — the core ROSCA domain entities.
 */
export const GroupFactory = {
  /**
   * Build a single `Group` with sensible defaults.
   *
   * @example
   * ```ts
   * const g = GroupFactory.buildGroup({ contributionAmount: 500 });
   * ```
   */
  buildGroup(overrides: Partial<Group> = {}): Group {
    return {
      id: 'grp-001',
      name: 'Test Savers',
      contributionAmount: 100,
      cycleDuration: 604800, // 1 week
      maxMembers: 5,
      currentMembers: 0,
      status: 'Active',
      tags: ['test'],
      ...overrides,
    };
  },

  /**
   * Build a single `Member`.
   *
   * @param index  Numeric index for deterministic ids/addresses.
   * @param overrides  Partial field overrides.
   */
  buildMember(index = 1, overrides: Partial<Member> = {}): Member {
    const label = `member${index}`;
    return {
      id: `mbr-${String(index).padStart(3, '0')}`,
      address: stellarAddress(label),
      name: `Member ${index}`,
      joinedAt: Date.now() - index * 60_000,
      groupIds: [],
      ...overrides,
    };
  },

  /**
   * Build a contribution `Transaction` for a member in a group.
   */
  buildTransaction(
    groupId: string,
    member: Member,
    txIndex: number,
    overrides: Partial<Transaction> = {},
  ): Transaction {
    return {
      id: `tx-${groupId}-${String(txIndex).padStart(3, '0')}`,
      groupId,
      memberAddress: member.address,
      amount: 100,
      type: 'contribution',
      timestamp: Date.now() - txIndex * 30_000,
      stellarTxHash: `HASH${groupId.toUpperCase()}${String(txIndex).padStart(6, '0')}`,
      ...overrides,
    };
  },

  /**
   * Build a `UserInteraction` record.
   *
   * @param overrides  Partial overrides — `userId`, `groupId`, `interactionType`, `timestamp`.
   */
  buildUserInteraction(overrides: Partial<UserInteraction> = {}): UserInteraction {
    return {
      userId: 'user-001',
      groupId: 'grp-001',
      interactionType: 'join',
      timestamp: Date.now(),
      ...overrides,
    };
  },

  /**
   * Build multiple `UserInteraction` records spanning several users and groups.
   *
   * @param count         Number of records to create.
   * @param userCount     Number of distinct user ids to cycle through.
   * @param groupCount    Number of distinct group ids to cycle through.
   */
  buildUserInteractions(count = 3, userCount = 2, groupCount = 2): UserInteraction[] {
    const types: UserInteraction['interactionType'][] = ['join', 'view', 'contribute'];
    return Array.from({ length: count }, (_, i) => ({
      userId: `user-${(i % userCount) + 1}`,
      groupId: `grp-${String((i % groupCount) + 1).padStart(3, '0')}`,
      interactionType: types[i % types.length],
      timestamp: Date.now() - i * 5_000,
    }));
  },

  /**
   * Build a `UserPreference` record.
   *
   * @param userId    The user this preference belongs to.
   * @param overrides Partial field overrides.
   */
  buildUserPreference(userId = 'user-001', overrides: Partial<UserPreference> = {}): UserPreference {
    return {
      userId,
      minContribution: 50,
      maxContribution: 1000,
      preferredDuration: 604800,
      tags: ['weekly'],
      ...overrides,
    };
  },

  /**
   * Build a `Map<string, UserPreference>` keyed by userId — ready to pass to
   * `ExportService`, `RecommendationEngine`, etc.
   *
   * @param userIds   List of user IDs to seed (defaults to three generic users).
   */
  buildUserPreferenceMap(userIds = ['user-001', 'user-002', 'user-003']): Map<string, UserPreference> {
    const map = new Map<string, UserPreference>();
    userIds.forEach((id) => map.set(id, GroupFactory.buildUserPreference(id)));
    return map;
  },

  // ── Composite builders ─────────────────────────────────────────────────────

  /**
   * Build a group where all `memberCount` members have contributed.
   * Ideal for testing payout-trigger logic.
   */
  buildGroupWithMembers(memberCount: number, groupOverrides: Partial<Group> = {}): GroupFixture {
    if (memberCount < 1) throw new RangeError('memberCount must be ≥ 1');
    if (memberCount > 20) throw new RangeError('memberCount must be ≤ 20');

    const group = GroupFactory.buildGroup({
      maxMembers: memberCount,
      currentMembers: memberCount,
      ...groupOverrides,
    });

    const members = Array.from({ length: memberCount }, (_, i) =>
      GroupFactory.buildMember(i + 1, { groupIds: [group.id] }),
    );

    const transactions = members.map((m, i) =>
      GroupFactory.buildTransaction(group.id, m, i + 1, { amount: group.contributionAmount }),
    );

    const contributionStates: MemberContributionState[] = members.map((m, i) => ({
      member: m,
      hasContributed: true,
      transaction: transactions[i],
    }));

    return { group, members, transactions, contributionStates };
  },

  /**
   * Build a group where the first `contributedCount` members have contributed.
   * Useful for mid-cycle and partial-payment scenarios.
   */
  buildMixedContributionGroup(
    memberCount: number,
    contributedCount: number,
    groupOverrides: Partial<Group> = {},
  ): GroupFixture {
    if (memberCount < 1) throw new RangeError('memberCount must be ≥ 1');
    if (memberCount > 20) throw new RangeError('memberCount must be ≤ 20');
    if (contributedCount < 0 || contributedCount > memberCount) {
      throw new RangeError(
        `contributedCount (${contributedCount}) must be 0–${memberCount}`,
      );
    }

    const group = GroupFactory.buildGroup({
      maxMembers: memberCount,
      currentMembers: memberCount,
      ...groupOverrides,
    });

    const members = Array.from({ length: memberCount }, (_, i) =>
      GroupFactory.buildMember(i + 1, { groupIds: [group.id] }),
    );

    const transactions: Transaction[] = [];
    const contributionStates: MemberContributionState[] = members.map((m, i) => {
      if (i < contributedCount) {
        const tx = GroupFactory.buildTransaction(group.id, m, transactions.length + 1, {
          amount: group.contributionAmount,
        });
        transactions.push(tx);
        return { member: m, hasContributed: true, transaction: tx };
      }
      return { member: m, hasContributed: false };
    });

    return { group, members, transactions, contributionStates };
  },

  /**
   * One contribution away from triggering a payout.
   * Requires `memberCount ≥ 2`.
   */
  buildNearPayoutGroup(memberCount: number, groupOverrides: Partial<Group> = {}): GroupFixture {
    if (memberCount < 2) throw new RangeError('memberCount must be ≥ 2 for near-payout state');
    return GroupFactory.buildMixedContributionGroup(memberCount, memberCount - 1, groupOverrides);
  },

  /**
   * Build a completed group — all members have received a payout.
   */
  buildCompletedGroup(memberCount: number, groupOverrides: Partial<Group> = {}): GroupFixture {
    if (memberCount < 1) throw new RangeError('memberCount must be ≥ 1');

    const group = GroupFactory.buildGroup({
      maxMembers: memberCount,
      currentMembers: memberCount,
      status: 'Completed',
      ...groupOverrides,
    });

    const members = Array.from({ length: memberCount }, (_, i) =>
      GroupFactory.buildMember(i + 1, { groupIds: [group.id] }),
    );

    const transactions = members.map((m, i) =>
      GroupFactory.buildTransaction(group.id, m, i + 1, {
        type: 'payout',
        amount: group.contributionAmount * memberCount,
      }),
    );

    return {
      group,
      members,
      transactions,
      contributionStates: members.map((m) => ({ member: m, hasContributed: true })),
    };
  },

  /**
   * Build a paused group (some members paid before the pause).
   */
  buildPausedGroup(
    memberCount: number,
    contributedCount: number,
    groupOverrides: Partial<Group> = {},
  ): GroupFixture {
    return GroupFactory.buildMixedContributionGroup(memberCount, contributedCount, {
      status: 'Paused',
      ...groupOverrides,
    });
  },

  /**
   * Build an array of `count` groups with distinct ids and names.
   */
  buildGroupList(count: number, groupOverrides: Partial<Group> = {}): Group[] {
    const nextId = makeSeq('grp-');
    return Array.from({ length: count }, (_, i) =>
      GroupFactory.buildGroup({
        id: nextId(),
        name: `Test Group ${i + 1}`,
        currentMembers: i % 3,
        ...groupOverrides,
      }),
    );
  },
};

// ─── BackupFactory ────────────────────────────────────────────────────────────

/**
 * In-memory S3 mock compatible with `BackupService` and `RecoveryService`.
 * Exposes the underlying `store` Map for inspection in tests.
 */
export type MockS3Client = S3Client & { store: Map<string, Buffer> };

/**
 * Factory for `BackupJob`, `BackupAlert`, and the in-memory S3 mock client.
 */
export const BackupFactory = {
  /**
   * Create a fresh in-memory S3 mock client.
   * Each call returns an **independent** instance with its own store.
   *
   * @example
   * ```ts
   * const s3 = BackupFactory.makeMockS3();
   * const service = new BackupService(s3);
   * ```
   */
  makeMockS3(): MockS3Client {
    const store = new Map<string, Buffer>();
    return {
      store,
      async putObject({ Key, Body }: { Bucket: string; Key: string; Body: Buffer; ContentType: string }) {
        store.set(Key, Body);
      },
      async getObject({ Key }: { Bucket: string; Key: string }): Promise<Buffer> {
        const data = store.get(Key);
        if (!data) throw new Error(`S3 key not found: ${Key}`);
        return data;
      },
      async listObjects({ Prefix }: { Bucket: string; Prefix: string }): Promise<string[]> {
        return Array.from(store.keys()).filter((k) => k.startsWith(Prefix));
      },
      async deleteObject({ Key }: { Bucket: string; Key: string }) {
        store.delete(Key);
      },
    };
  },

  /**
   * Build a `BackupJob` fixture.
   *
   * Defaults to a completed full backup.
   *
   * @param overrides  Partial field overrides.
   */
  buildBackupJob(overrides: Partial<BackupJob> = {}): BackupJob {
    const id = overrides.id ?? 'job-001';
    const now = Date.now();
    return {
      id,
      type: 'full',
      status: 'completed',
      createdAt: now - 60_000,
      completedAt: now - 30_000,
      s3Key: `backups/full/${id}.json`,
      sizeBytes: 1024,
      checksum: crypto.createHash('sha256').update(id).digest('hex'),
      ...overrides,
    };
  },

  /**
   * Build a `BackupAlert` fixture.
   */
  buildBackupAlert(overrides: Partial<BackupAlert> = {}): BackupAlert {
    return {
      id: 'alert-001',
      backupJobId: 'job-001',
      level: 'warning',
      message: 'Backup is stale',
      timestamp: Date.now(),
      acknowledged: false,
      ...overrides,
    };
  },

  /**
   * Build a serialised backup payload (the JSON body stored in S3) with seeded
   * row data for the four key tables.
   *
   * @param opts  Optional row counts per table.
   */
  buildBackupPayload(opts: {
    groups?: number;
    members?: number;
    transactions?: number;
    preferences?: number;
  } = {}): Record<string, unknown> {
    const {
      groups: groupCount = 2,
      members: memberCount = 4,
      transactions: txCount = 4,
      preferences: prefCount = 2,
    } = opts;

    return {
      type: 'full',
      baseBackupId: null,
      timestamp: Date.now(),
      data: {
        groups: Array.from({ length: groupCount }, (_, i) => ({
          id: `group-${i + 1}`,
          name: `Savings Group ${i + 1}`,
          contributionAmount: (i + 1) * 100,
          cycleDuration: 604800,
          maxMembers: 10,
          status: 'active',
        })),
        members: Array.from({ length: memberCount }, (_, i) => ({
          id: `member-${i + 1}`,
          address: stellarAddress(`member${i + 1}`),
          groupId: `group-${(i % groupCount) + 1}`,
          joinedAt: Date.now() - i * 86_400_000,
        })),
        transactions: Array.from({ length: txCount }, (_, i) => ({
          id: `tx-${i + 1}`,
          groupId: `group-${(i % groupCount) + 1}`,
          memberAddress: stellarAddress(`member${(i % memberCount) + 1}`),
          amount: 100,
          type: i % 2 === 0 ? 'contribution' : 'payout',
          stellarTxHash: crypto.randomUUID().replace(/-/g, '').toUpperCase(),
        })),
        preferences: Array.from({ length: prefCount }, (_, i) => ({
          userId: `user-${i + 1}`,
          emailNotifications: true,
          pushNotifications: i % 2 === 0,
          contributionReminders: true,
        })),
      },
    };
  },
};

// ─── NotificationFactory ──────────────────────────────────────────────────────

/** Shape of a mock `NotificationPreference` record (mirrors Prisma model). */
export interface MockNotificationPreference {
  id: string;
  userId: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  contributionReminders: boolean;
  groupUpdates: boolean;
  payoutNotifications: boolean;
  emailFrequency: 'immediate' | 'daily' | 'weekly' | 'never';
  locale: string;
  unsubscribeToken: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape of a mock `NotificationTemplate` record. */
export interface MockNotificationTemplate {
  id: string;
  templateKey: string;
  templateName: string;
  templateType: 'email' | 'push';
  subject?: string;
  htmlContent: string;
  textContent: string;
  placeholders: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape of a mock `Notification` record. */
export interface MockNotification {
  id: string;
  userId: string;
  templateId: string;
  notificationType: 'email' | 'push';
  recipient: string;
  subject?: string;
  renderedContent: string;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Factory for notification domain objects — preferences, templates, and
 * notification records.
 */
export const NotificationFactory = {
  /**
   * Build a `NotificationPreference` record.
   *
   * @param userId    The owning user id.
   * @param overrides Partial field overrides.
   */
  buildPreference(
    userId = 'user-001',
    overrides: Partial<MockNotificationPreference> = {},
  ): MockNotificationPreference {
    return {
      id: testId('pref', userId),
      userId,
      emailNotifications: true,
      pushNotifications: true,
      contributionReminders: true,
      groupUpdates: true,
      payoutNotifications: true,
      emailFrequency: 'immediate',
      locale: 'en',
      unsubscribeToken: testId('tok', userId),
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    };
  },

  /**
   * Build a list of `NotificationPreference` records for multiple users.
   */
  buildPreferences(
    userIds: string[],
    overrides: Partial<MockNotificationPreference> = {},
  ): MockNotificationPreference[] {
    return userIds.map((id) => NotificationFactory.buildPreference(id, overrides));
  },

  /**
   * Build a `NotificationTemplate` record.
   *
   * @param templateKey  The template key string (e.g. `'email_contribution_reminder'`).
   * @param overrides    Partial field overrides.
   */
  buildTemplate(
    templateKey = 'email_contribution_reminder',
    overrides: Partial<MockNotificationTemplate> = {},
  ): MockNotificationTemplate {
    const isEmail = templateKey.startsWith('email_');
    return {
      id: testId('tmpl', templateKey),
      templateKey,
      templateName: templateKey
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()),
      templateType: isEmail ? 'email' : 'push',
      subject: isEmail ? 'Notification: {{groupName}}' : undefined,
      htmlContent: '<p>Hello {{userName}}, action required for {{groupName}}.</p>',
      textContent: 'Hello {{userName}}, action required for {{groupName}}.',
      placeholders: ['userName', 'groupName'],
      active: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    };
  },

  /**
   * Build a list of active notification templates (email + push pair).
   */
  buildTemplateList(): MockNotificationTemplate[] {
    return [
      NotificationFactory.buildTemplate('email_contribution_reminder'),
      NotificationFactory.buildTemplate('push_contribution_reminder'),
      NotificationFactory.buildTemplate('email_payout_notification'),
      NotificationFactory.buildTemplate('push_payout_notification'),
    ];
  },

  /**
   * Build a `Notification` record.
   *
   * @param userId    The recipient user id.
   * @param overrides Partial field overrides.
   */
  buildNotification(
    userId = 'user-001',
    overrides: Partial<MockNotification> = {},
  ): MockNotification {
    return {
      id: testId('notif', userId),
      userId,
      templateId: testId('tmpl', 'email_contribution_reminder'),
      notificationType: 'email',
      recipient: `${userId}@example.com`,
      subject: 'Contribution reminder',
      renderedContent: '<p>Hello, your contribution is due.</p>',
      status: 'sent',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date('2026-01-15T10:00:00Z'),
      updatedAt: new Date('2026-01-15T10:00:00Z'),
      ...overrides,
    };
  },

  /**
   * Build an array of sent notification records.
   *
   * @param count   Number of records to build (defaults to 2).
   * @param userId  The recipient user id.
   */
  buildNotificationList(count = 2, userId = 'user-001'): MockNotification[] {
    return Array.from({ length: count }, (_, i) =>
      NotificationFactory.buildNotification(userId, {
        id: `notif-${String(i + 1).padStart(3, '0')}`,
        status: 'sent',
      }),
    );
  },

  /**
   * Build a mock `notificationStats` response as returned by
   * `NotificationService.getNotificationStats()`.
   */
  buildNotificationStats(overrides: Partial<{
    totalSent: number;
    totalFailed: number;
    totalPending: number;
    byType: Record<string, number>;
  }> = {}) {
    return {
      totalSent: 1000,
      totalFailed: 50,
      totalPending: 20,
      byType: { email: 800, push: 250 },
      ...overrides,
    };
  },

  /**
   * Build a mock `preferenceStats` response as returned by
   * `UserPreferenceManager.getPreferenceStats()`.
   */
  buildPreferenceStats(overrides: Partial<{
    total: number;
    emailEnabled: number;
    pushEnabled: number;
    emailEnabledPercent: string;
    pushEnabledPercent: string;
    byFrequency: Record<string, number>;
  }> = {}) {
    return {
      total: 1000,
      emailEnabled: 750,
      pushEnabled: 600,
      emailEnabledPercent: '75.00',
      pushEnabledPercent: '60.00',
      byFrequency: { immediate: 400, daily: 200, weekly: 150, never: 250 },
      ...overrides,
    };
  },
};

// ─── AnalyticsFactory ─────────────────────────────────────────────────────────

/** Shape of a mock PlatformMetrics record (mirrors Prisma model). */
export interface MockPlatformMetrics {
  id: string;
  date: Date;
  totalUsers: number;
  activeUsers: number;
  totalGroups: number;
  activeGroups: number;
  totalContributions: number;
  totalContributionAmount: number;
  totalPayouts: number;
  totalPayoutAmount: number;
  averageGroupSize: number;
  successRate: number;
  totalTransactions: number;
  uniqueWallets: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape of a mock UserMetrics record. */
export interface MockUserMetrics {
  id: string;
  userId: string;
  date: Date;
  groupsJoined: number;
  groupsCreated: number;
  groupsCompleted: number;
  totalContributions: number;
  totalContributionAmount: number;
  totalPayoutsReceived: number;
  sessionsCount: number;
  sessionDurationMinutes: number;
  pageViews: number;
  interactionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape of a mock GroupMetrics record. */
export interface MockGroupMetrics {
  id: string;
  groupId: string;
  date: Date;
  memberCount: number;
  totalContributions: number;
  totalContributionAmount: number;
  totalPayoutsDistributed: number;
  successRate: number;
  averageContributionSize: number;
  newMembersCount: number;
  churnCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Shape of a mock AnalyticsEvent record. */
export interface MockAnalyticsEvent {
  id: string;
  eventType: string;
  eventName: string;
  userId?: string;
  groupId?: string;
  eventData?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Factory for analytics domain objects — platform metrics, user metrics,
 * group metrics, and raw analytics events.
 */
export const AnalyticsFactory = {
  /**
   * Build a `PlatformMetrics` record for a given date.
   *
   * @param date      The date to associate (defaults to today at midnight UTC).
   * @param overrides Partial field overrides.
   */
  buildPlatformMetrics(
    date?: Date,
    overrides: Partial<MockPlatformMetrics> = {},
  ): MockPlatformMetrics {
    const d = date ?? (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    })();

    return {
      id: testId('plat', d.toISOString()),
      date: d,
      totalUsers: 100,
      activeUsers: 80,
      totalGroups: 20,
      activeGroups: 15,
      totalContributions: 500,
      totalContributionAmount: 5000,
      totalPayouts: 400,
      totalPayoutAmount: 4000,
      averageGroupSize: 5,
      successRate: 80,
      totalTransactions: 900,
      uniqueWallets: 60,
      createdAt: d,
      updatedAt: d,
      ...overrides,
    };
  },

  /**
   * Build a series of `PlatformMetrics` records — one per day going back
   * `days` days from today.
   *
   * @param days  Number of days to generate (defaults to 5).
   */
  buildPlatformMetricsSeries(days = 5): MockPlatformMetrics[] {
    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return AnalyticsFactory.buildPlatformMetrics(d, {
        totalUsers: 100 + i * 10,
        activeUsers: 80 + i * 5,
        totalContributions: 500 + i * 50,
        totalContributionAmount: 5000 + i * 500,
        totalPayouts: 400 + i * 40,
        totalPayoutAmount: 4000 + i * 400,
        totalTransactions: 900 + i * 90,
        uniqueWallets: 60 + i * 5,
      });
    });
  },

  /**
   * Build a `UserMetrics` record for the given user on a given date.
   *
   * @param userId    The user id.
   * @param date      The metrics date (defaults to today at midnight).
   * @param overrides Partial field overrides.
   */
  buildUserMetrics(
    userId = 'user-001',
    date?: Date,
    overrides: Partial<MockUserMetrics> = {},
  ): MockUserMetrics {
    const d = date ?? (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    })();

    return {
      id: testId('um', `${userId}-${d.toISOString()}`),
      userId,
      date: d,
      groupsJoined: 5,
      groupsCreated: 2,
      groupsCompleted: 1,
      totalContributions: 10,
      totalContributionAmount: 500,
      totalPayoutsReceived: 400,
      sessionsCount: 8,
      sessionDurationMinutes: 120,
      pageViews: 50,
      interactionCount: 150,
      createdAt: d,
      updatedAt: d,
      ...overrides,
    };
  },

  /**
   * Build a `GroupMetrics` record for the given group on a given date.
   *
   * @param groupId   The group id.
   * @param date      The metrics date (defaults to today at midnight).
   * @param overrides Partial field overrides.
   */
  buildGroupMetrics(
    groupId = 'grp-001',
    date?: Date,
    overrides: Partial<MockGroupMetrics> = {},
  ): MockGroupMetrics {
    const d = date ?? (() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    })();

    return {
      id: testId('gm', `${groupId}-${d.toISOString()}`),
      groupId,
      date: d,
      memberCount: 10,
      totalContributions: 50,
      totalContributionAmount: 2500,
      totalPayoutsDistributed: 2000,
      successRate: 90,
      averageContributionSize: 50,
      newMembersCount: 3,
      churnCount: 1,
      createdAt: d,
      updatedAt: d,
      ...overrides,
    };
  },

  /**
   * Build a raw `AnalyticsEvent` record.
   *
   * @param eventType  The event type string.
   * @param overrides  Partial field overrides.
   */
  buildEvent(eventType = 'page_view', overrides: Partial<MockAnalyticsEvent> = {}): MockAnalyticsEvent {
    return {
      id: testId('evt', `${eventType}-${Date.now()}`),
      eventType,
      eventName: 'dashboard_view',
      userId: 'user-001',
      groupId: undefined,
      eventData: undefined,
      createdAt: new Date(),
      ...overrides,
    };
  },

  /**
   * Build a batch of analytics events spanning multiple users and groups.
   *
   * @param count   Number of events (defaults to 10).
   */
  buildEventBatch(count = 10): MockAnalyticsEvent[] {
    return Array.from({ length: count }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setTime(d.getTime() + Math.random() * 86_400_000);
      return AnalyticsFactory.buildEvent(i % 2 === 0 ? 'page_view' : 'click', {
        id: `evt-${String(i + 1).padStart(3, '0')}`,
        eventName: `test_event_${i}`,
        userId: `user-${(i % 3) + 1}`,
        groupId: `grp-${(i % 2) + 1}`,
        createdAt: d,
      });
    });
  },
};

// ─── AuditFactory ─────────────────────────────────────────────────────────────

/** Shape of a mock AuditLog record. */
export interface MockAuditLog {
  id: string;
  userId: string;
  action: string;
  targetId?: string;
  targetType?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * Factory for audit log records.
 */
export const AuditFactory = {
  /**
   * Build an `AuditLog` entry.
   *
   * @param action    The action name (e.g. `'UPDATE_USER'`).
   * @param overrides Partial field overrides.
   */
  buildAuditLog(action = 'UPDATE_USER', overrides: Partial<MockAuditLog> = {}): MockAuditLog {
    return {
      id: testId('log', action),
      userId: 'admin-001',
      action,
      targetId: 'user-001',
      targetType: 'User',
      timestamp: Date.now(),
      metadata: {},
      ...overrides,
    };
  },
};

// ─── ReputationFactory ────────────────────────────────────────────────────────

/** Shape of a mock member reputation record. */
export interface MockMemberReputation {
  address: string;
  score: number;
  totalContributions: number;
  onTimeContributions: number;
  updatedAt: string;
}

/**
 * Factory for member reputation records.
 */
export const ReputationFactory = {
  /**
   * Build a member reputation record.
   *
   * @param address   Stellar wallet address (defaults to a deterministic test address).
   * @param overrides Partial field overrides.
   */
  buildReputation(
    address = stellarAddress('testmember1'),
    overrides: Partial<MockMemberReputation> = {},
  ): MockMemberReputation {
    return {
      address,
      score: 0.85,
      totalContributions: 20,
      onTimeContributions: 17,
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  },

  /**
   * Build a default (zero-score) reputation record as returned when no DB
   * record exists yet.
   */
  buildDefaultReputation(address = 'GTEST123'): MockMemberReputation {
    return {
      address,
      score: 0,
      totalContributions: 0,
      onTimeContributions: 0,
      updatedAt: expect.any(String) as unknown as string,
    };
  },
};

// ─── ServiceMockFactory ───────────────────────────────────────────────────────

/**
 * Factory for typed service and middleware mocks shared across Express route
 * and controller unit tests.
 */
export const ServiceMockFactory = {
  /**
   * Build a minimal mock `EventIndexer` compatible with the health/ready
   * route wiring.
   *
   * @param overrides  Partial method overrides — any method not overridden
   *                   defaults to `jest.fn()`.
   */
  buildMockEventIndexer(overrides: Partial<{
    readinessCheckDatabase: jest.Mock;
    readinessCheckHorizon: jest.Mock;
  }> = {}) {
    return {
      readinessCheckDatabase: jest.fn().mockResolvedValue({ up: true, latencyMs: 5 }),
      readinessCheckHorizon: jest.fn().mockResolvedValue({ up: true, latencyMs: 12 }),
      ...overrides,
    };
  },

  /**
   * Build a full mock `V1Services` object for route-level unit tests.
   * Every service property is replaced with an empty object (`{}`); override
   * the ones your test actually exercises.
   */
  buildMockServices(overrides: Record<string, unknown> = {}) {
    return {
      engine: {},
      exportService: {},
      backupService: {},
      backupScheduler: {},
      forwardingService: {},
      recoveryService: {},
      backupMonitor: {},
      backupRestoreDrill: {},
      eventIndexer: ServiceMockFactory.buildMockEventIndexer(),
      feedbackService: {},
      ...overrides,
    } as any;
  },

  /**
   * Build a minimal mock Express `Request` object.
   *
   * @param body    Request body.
   * @param query   Query string parameters.
   * @param params  Route parameters.
   */
  buildMockRequest(
    body: unknown = {},
    query: unknown = {},
    params: unknown = {},
  ) {
    return { body, query, params } as import('express').Request;
  },

  /**
   * Build a minimal mock Express `Response` object.
   */
  buildMockResponse() {
    return {} as import('express').Response;
  },

  /**
   * Capture calls to an Express `next()` function.
   * Returns the `next` function and a `calls` array.
   */
  captureNext(): { next: import('express').NextFunction; calls: unknown[] } {
    const calls: unknown[] = [];
    const next = (arg?: unknown) => { calls.push(arg); };
    return { next: next as import('express').NextFunction, calls };
  },
};
