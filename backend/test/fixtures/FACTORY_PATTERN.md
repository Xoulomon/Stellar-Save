# Fixture Factory Pattern

This document explains how to write and extend fixtures for the backend test
suite. All shared test data lives in `backend/test/fixtures/factory.ts` — the
single source of truth for domain objects.

---

## Why a shared factory?

Without a central fixture factory:

- Every test file hand-builds the same objects inline.
- When a model changes (new required field, renamed field, changed type) you
  have to hunt down every inline literal and update it.
- Tests assert on magic strings/numbers copied from adjacent test files, making
  drift invisible until something breaks in production.

A shared factory solves all three problems: change the default once, and every
test that uses it immediately reflects the new shape.

---

## Available factories

| Export                | What it builds                                                          |
|-----------------------|-------------------------------------------------------------------------|
| `GroupFactory`        | `Group`, `Member`, `Transaction`, `UserInteraction`, `UserPreference`   |
| `BackupFactory`       | `BackupJob`, `BackupAlert`, in-memory S3 mock client                    |
| `NotificationFactory` | `NotificationPreference`, `NotificationTemplate`, `Notification`        |
| `AnalyticsFactory`    | `PlatformMetrics`, `UserMetrics`, `GroupMetrics`, `AnalyticsEvent`      |
| `AuditFactory`        | `AuditLog`                                                              |
| `ReputationFactory`   | Member reputation records                                               |
| `ServiceMockFactory`  | Typed Express/service mocks reused across route-level tests             |

---

## Quick-start

```ts
import {
  GroupFactory,
  BackupFactory,
  NotificationFactory,
  AnalyticsFactory,
  AuditFactory,
  ReputationFactory,
  ServiceMockFactory,
} from '../fixtures/factory'; // adjust relative path as needed
```

### GroupFactory

```ts
// Single group with defaults
const group = GroupFactory.buildGroup();

// Override only what the test cares about
const group = GroupFactory.buildGroup({ contributionAmount: 500, maxMembers: 3 });

// List of 10 distinct groups
const groups = GroupFactory.buildGroupList(10);

// All members contributed → payout-trigger scenario
const { group, members, transactions, contributionStates } =
  GroupFactory.buildGroupWithMembers(5, { contributionAmount: 200 });

// Mid-cycle: 4 of 6 have paid
const { contributionStates } = GroupFactory.buildMixedContributionGroup(6, 4);

// One contribution away from payout
const { contributionStates } = GroupFactory.buildNearPayoutGroup(5);

// Completed group (all payouts distributed)
const { group, transactions } = GroupFactory.buildCompletedGroup(4);

// Paused group
const { group } = GroupFactory.buildPausedGroup(6, 3);

// UserInteraction records
const interactions = GroupFactory.buildUserInteractions(5, 3, 2);

// UserPreference map (keyed by userId)
const prefMap = GroupFactory.buildUserPreferenceMap(['user-1', 'user-2']);
```

### BackupFactory

```ts
// Fresh in-memory S3 mock (each call returns an independent instance)
const s3 = BackupFactory.makeMockS3();
const service = new BackupService(s3);

// Inspect stored keys directly
expect(s3.store.size).toBeGreaterThan(0);

// BackupJob fixture
const job = BackupFactory.buildBackupJob({ type: 'incremental', status: 'running' });

// BackupAlert fixture
const alert = BackupFactory.buildBackupAlert({ level: 'error', acknowledged: true });

// Serialised S3 payload with seeded row data
const payload = BackupFactory.buildBackupPayload({ groups: 3, members: 9 });
```

### NotificationFactory

```ts
// Preference for a user
const pref = NotificationFactory.buildPreference('user-42');

// Override specific fields
const pref = NotificationFactory.buildPreference('user-42', {
  emailNotifications: false,
  emailFrequency: 'weekly',
});

// Multiple preferences at once
const prefs = NotificationFactory.buildPreferences(['user-1', 'user-2', 'user-3']);

// Template
const tmpl = NotificationFactory.buildTemplate('email_contribution_reminder');
const templates = NotificationFactory.buildTemplateList(); // email + push pairs

// Notification record
const notif = NotificationFactory.buildNotification('user-42', { status: 'failed' });
const notifs = NotificationFactory.buildNotificationList(5, 'user-42');

// Aggregate stats (for mocking service methods)
const stats = NotificationFactory.buildNotificationStats({ totalFailed: 0 });
const prefStats = NotificationFactory.buildPreferenceStats();
```

### AnalyticsFactory

```ts
// Platform metrics for a specific date
const metrics = AnalyticsFactory.buildPlatformMetrics(new Date('2026-01-01'));

// 7-day trend series
const trend = AnalyticsFactory.buildPlatformMetricsSeries(7);

// User and group metrics
const userMetrics = AnalyticsFactory.buildUserMetrics('user-1');
const groupMetrics = AnalyticsFactory.buildGroupMetrics('grp-001');

// Raw events
const event = AnalyticsFactory.buildEvent('page_view');
const batch = AnalyticsFactory.buildEventBatch(20);
```

### AuditFactory

```ts
const log = AuditFactory.buildAuditLog('FLAG_GROUP', {
  userId: 'admin-001',
  targetId: 'grp-007',
  targetType: 'Group',
  metadata: { flagged: true },
});
```

### ReputationFactory

```ts
const rep = ReputationFactory.buildReputation('GABC...', {
  score: 0.92,
  totalContributions: 30,
  onTimeContributions: 28,
});

// Default zero-score record (before any contributions)
const blank = ReputationFactory.buildDefaultReputation('GABC...');
```

### ServiceMockFactory

```ts
// Mock Express request / response / next
const req = ServiceMockFactory.buildMockRequest({ amount: 100 }, { page: '1' });
const res = ServiceMockFactory.buildMockResponse();
const { next, calls } = ServiceMockFactory.captureNext();

// Mock services object for V1 route tests
const services = ServiceMockFactory.buildMockServices({
  backupService: { createBackup: jest.fn().mockResolvedValue(job) },
});
```

---

## Extending the factory

1. **Add a builder** to `factory.ts` inside the appropriate factory object (or
   create a new named export if the domain warrants it).
2. Keep every builder **pure** — no I/O, no network calls, no global mutations.
3. Accept a `Partial<YourType>` overrides parameter so tests only specify what
   matters for the scenario.
4. Add a short section to this file under an `##` heading.
5. Export any new TypeScript interface types alongside the factory.

### Minimal example

```ts
// In factory.ts

export interface MockFraudFlag {
  id: string;
  entityType: 'account' | 'group';
  entityId: string;
  riskScore: number;
  status: 'pending' | 'reviewed' | 'dismissed';
}

export const FraudFactory = {
  buildFlag(overrides: Partial<MockFraudFlag> = {}): MockFraudFlag {
    return {
      id: 'flag-001',
      entityType: 'account',
      entityId: 'user-001',
      riskScore: 0.75,
      status: 'pending',
      ...overrides,
    };
  },
};
```

---

## Migrated test files

The following 10 test files were migrated from inline data to the factory as
part of issue #1734:

| File | Factory used |
|------|-------------|
| `src/tests/groups_service.test.ts` | `GroupFactory` |
| `src/tests/notification_service.test.ts` | `NotificationFactory` |
| `src/tests/notification_preference_repository.test.ts` | `NotificationFactory` |
| `src/tests/reputation_repository.test.ts` | `ReputationFactory` |
| `src/tests/reputation.test.ts` | `ReputationFactory` |
| `src/tests/kyc.test.ts` | inline builder `buildKycRecord()` (KYC model not in factory; pattern documented) |
| `src/tests/export.test.ts` | `GroupFactory` |
| `src/tests/backup.test.ts` | `BackupFactory` |
| `src/tests/admin_authz.test.ts` | `AuditFactory` |
| `src/tests/reminder_scheduler.test.ts` | `NotificationFactory` |

---

## Rules for new tests

- **Always** import from `test/fixtures/factory` rather than constructing
  domain objects inline.
- If a required field is missing from the factory, **add it to the factory**
  rather than adding it inline in the test.
- Keep test-specific values (IDs, amounts, dates) as overrides passed to the
  builder — do not modify factory defaults unless the default itself is wrong.
