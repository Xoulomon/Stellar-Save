# Issue #1556 — Add Analytics Event Contract Tests

## Summary

`backend/src/analytics_service.ts` exposes `recordEvent(eventType, eventName,
userId?, groupId?, eventData?, sessionId?)` as the single write path for all
tracked events. The `analytics_aggregator.ts` then queries rows by hard-coded
`eventType` strings (`'transaction'`, `'page_view'`, `'group_created'`,
`'group_completed'`, `'group_activity'`, `'join_group'`, `'member_joined'`,
`'member_left'`) to build platform, user, and group metrics.

There is currently no machine-readable schema that documents which event names
are valid, which `eventData` properties each event type requires, or which
`eventType`/`eventName` combinations the aggregator expects. A caller that
misspells `'group_created'` as `'groupCreated'`, or omits the required `amount`
field on a `transaction` event, will store a row that is silently ignored by
every aggregation query — producing metrics gaps that are impossible to
distinguish from genuine zero-activity periods.

---

## Current Event Inventory

Derived from `analytics_service.ts`, `analytics_aggregator.ts`, and
`analytics_middleware.ts`:

### Backend-emitted events (`recordEvent` calls)

| `eventType` | `eventName` (pattern) | Required `eventData` fields | Emitted by |
|---|---|---|---|
| `transaction` | `soroban_contribution_<id>` | `type: 'contribution'`, `amount: number`, `ledgerSeq`, `txHash`, `contractEventId` | `normalizeSorobanEvent()` |
| `transaction` | `soroban_payout_<id>` | `type: 'payout'`, `amount: number`, `ledgerSeq`, `txHash`, `contractEventId` | `normalizeSorobanEvent()` |
| `group_created` | free-form | none required | contract event indexer |
| `group_completed` | free-form | none required | contract event indexer |
| `group_activity` | free-form | none required | contract event indexer |
| `join_group` | free-form | none required | user action |
| `member_joined` | free-form | `memberAddress: string` | contract event indexer |
| `member_left` | free-form | none required | contract event indexer |
| `page_view` | free-form | none required | analytics middleware |

### Frontend contract events (`EventService.ts`)

These are Soroban RPC events that the frontend parses and which the backend
indexes separately:

| `type` | Required fields |
|---|---|
| `GroupCreated` | `groupId`, `creator`, `contributionAmount`, `cycleDuration`, `maxMembers`, `createdAt` |
| `MemberJoined` | `groupId`, `member`, `memberCount`, `joinedAt` |
| `ContributionMade` | `groupId`, `contributor`, `amount`, `cycle`, `cycleTotal`, `contributedAt` |
| `PayoutExecuted` | `groupId`, `recipient`, `amount`, `cycle`, `executedAt` |
| `GroupPaused` | `groupId`, `pausedAt` |

---

## Root Cause of the Gap

1. `recordEvent` accepts `eventType: string` and `eventName: string` with no
   validation against a known list. Any typo silently persists a row that the
   aggregator will never count.

2. The aggregator queries specific `eventType` values with no reference to a
   shared constant — the strings are duplicated across `analytics_service.ts`
   and `analytics_aggregator.ts`, making rename-drift inevitable.

3. There are no tests that assert: "if I call `recordEvent` with these
   arguments, the row stored in the DB has exactly this shape" or "the
   aggregator counts this event toward the correct metric bucket".

---

## Acceptance Criteria

### AC1 — Event schema defined

A TypeScript `const` object (or Zod schema) is the single source of truth for
all valid `eventType` values and their required `eventData` shapes:

```ts
// backend/src/analytics_schema.ts

export const ANALYTICS_EVENT_TYPES = [
  'transaction',
  'page_view',
  'group_created',
  'group_completed',
  'group_activity',
  'join_group',
  'member_joined',
  'member_left',
] as const;

export type AnalyticsEventType = typeof ANALYTICS_EVENT_TYPES[number];

export const EVENT_DATA_SCHEMA = {
  transaction: z.object({
    type: z.enum(['contribution', 'payout']),
    amount: z.number().nonnegative(),
    ledgerSeq: z.number().optional(),
    txHash: z.string().optional(),
    contractEventId: z.string().optional(),
  }),
  member_joined: z.object({
    memberAddress: z.string().min(1),
  }),
  // All other event types allow any eventData (no required fields)
  page_view: z.record(z.unknown()).optional(),
  group_created: z.record(z.unknown()).optional(),
  group_completed: z.record(z.unknown()).optional(),
  group_activity: z.record(z.unknown()).optional(),
  join_group: z.record(z.unknown()).optional(),
  member_left: z.record(z.unknown()).optional(),
} satisfies Partial<Record<AnalyticsEventType, z.ZodTypeAny>>;
```

`analytics_service.ts`, `analytics_aggregator.ts`, and any other caller must
import `ANALYTICS_EVENT_TYPES` / `AnalyticsEventType` instead of using bare
string literals.

### AC2 — Contract tests added

Tests must cover:

1. **Valid event stored correctly** — `recordEvent('transaction', 'soroban_contribution_1', userId, groupId, { type: 'contribution', amount: 100, txHash: '...' })` creates a row with exactly those fields.

2. **Invalid eventType rejected** — `recordEvent('typo_event', ...)` either throws or stores a row that is flagged, depending on chosen enforcement strategy (see §Options).

3. **Missing required eventData field** — `recordEvent('transaction', ..., { type: 'contribution' /* amount missing */ })` is rejected.

4. **Aggregator counts correct bucket** — a mocked `prisma.analyticsEvent.findMany` returning a `transaction/contribution` row causes `aggregatePlatformMetrics` to increment `totalContributions` (not `totalPayouts`).

5. **Unknown event ignored by aggregator** — a row with `eventType: 'unknown_event'` is not counted in any metric bucket.

### AC3 — Fail on unexpected / undocumented events

The contract test suite must include a test that iterates over `ANALYTICS_EVENT_TYPES` and asserts that no other string is used as an `eventType` in the codebase:

```ts
it('no undocumented eventType strings exist in the codebase', () => {
  // This is enforced by TypeScript types at compile time.
  // This test documents the contract and fails if ANALYTICS_EVENT_TYPES
  // shrinks without removing the corresponding call sites.
  expect(ANALYTICS_EVENT_TYPES).toContain('transaction');
  expect(ANALYTICS_EVENT_TYPES).toContain('page_view');
  // ... one assertion per documented type
  expect(ANALYTICS_EVENT_TYPES).toHaveLength(9); // update when adding new types
});
```

---

## Proposed Implementation

### Option A — TypeScript type enforcement only (lightest)

Replace `eventType: string` with `eventType: AnalyticsEventType` in
`recordEvent`'s signature. TypeScript will reject unknown values at compile
time. Add runtime Zod validation for `eventData` on the `transaction` and
`member_joined` types.

Pros: zero overhead at runtime for most events.
Cons: does not protect against values coming from dynamic paths (e.g. the
`normalizeSorobanEvent` result cast from raw DB data).

### Option B — Runtime validation in `recordEvent` (recommended)

```ts
// analytics_service.ts — updated recordEvent
async recordEvent(
  eventType: AnalyticsEventType,
  eventName: string,
  ...
): Promise<void> {
  // Validate eventType at runtime
  if (!(ANALYTICS_EVENT_TYPES as readonly string[]).includes(eventType)) {
    logger.warn(`Unknown analytics eventType: ${eventType} — event dropped`);
    return; // never throw — analytics must not break the app
  }

  // Validate eventData shape for typed events
  const schema = EVENT_DATA_SCHEMA[eventType];
  if (schema && eventData !== undefined) {
    const result = schema.safeParse(eventData);
    if (!result.success) {
      logger.warn(
        `Invalid eventData for eventType ${eventType}: ${result.error.message}`
      );
      return;
    }
  }

  await this.prisma.analyticsEvent.create({ data: { eventType, eventName, ... } });
}
```

Pros: catches dynamic paths; safe (never throws); logs actionable warnings.
Cons: slight overhead per event call.

---

## Suggested Test File

```ts
// backend/src/tests/analytics_contract.test.ts

import { ANALYTICS_EVENT_TYPES } from '../analytics_schema';
import { AnalyticsService } from '../analytics_service';

describe('analytics event contract', () => {
  let service: AnalyticsService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      analyticsEvent: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    service = new AnalyticsService(mockPrisma);
  });

  it('records a valid transaction/contribution event', async () => {
    await service.recordEvent('transaction', 'soroban_contribution_1', 'user1', 'group1', {
      type: 'contribution',
      amount: 100,
      txHash: 'abc123',
    });
    expect(mockPrisma.analyticsEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'transaction',
          eventData: expect.objectContaining({ type: 'contribution', amount: 100 }),
        }),
      }),
    );
  });

  it('drops an event with an undocumented eventType', async () => {
    await service.recordEvent('unknown_event' as any, 'test', undefined, undefined, {});
    expect(mockPrisma.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('drops a transaction event with missing amount field', async () => {
    await service.recordEvent('transaction', 'bad_tx', undefined, undefined, {
      type: 'contribution',
      // amount deliberately missing
    });
    expect(mockPrisma.analyticsEvent.create).not.toHaveBeenCalled();
  });

  it('documents all valid event types', () => {
    expect(ANALYTICS_EVENT_TYPES).toContain('transaction');
    expect(ANALYTICS_EVENT_TYPES).toContain('page_view');
    expect(ANALYTICS_EVENT_TYPES).toContain('group_created');
    expect(ANALYTICS_EVENT_TYPES).toContain('group_completed');
    expect(ANALYTICS_EVENT_TYPES).toContain('group_activity');
    expect(ANALYTICS_EVENT_TYPES).toContain('join_group');
    expect(ANALYTICS_EVENT_TYPES).toContain('member_joined');
    expect(ANALYTICS_EVENT_TYPES).toContain('member_left');
    // Update this count when adding new event types
    expect(ANALYTICS_EVENT_TYPES).toHaveLength(8);
  });

  it('aggregator counts contribution in totalContributions bucket', async () => {
    mockPrisma.analyticsEvent.findMany.mockResolvedValue([
      {
        eventType: 'transaction',
        userId: 'user1',
        groupId: 'group1',
        sessionId: 'session1',
        eventData: { type: 'contribution', amount: 500 },
      },
    ]);
    mockPrisma.platformMetrics = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    };

    const { AnalyticsAggregator } = await import('../analytics_aggregator');
    const aggregator = new AnalyticsAggregator(mockPrisma);
    await aggregator.runAggregation();

    expect(mockPrisma.platformMetrics.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totalContributions: 1 }),
      }),
    );
  });
});
```

---

## Affected Files

| File | Change type |
|---|---|
| `backend/src/analytics_schema.ts` | New: `ANALYTICS_EVENT_TYPES`, `AnalyticsEventType`, `EVENT_DATA_SCHEMA` |
| `backend/src/analytics_service.ts` | Update `recordEvent` signature to `AnalyticsEventType`; add runtime validation |
| `backend/src/analytics_aggregator.ts` | Replace bare string literals with imports from `analytics_schema.ts` |
| `backend/src/tests/analytics_contract.test.ts` | New: contract tests covering all ACs |

---

## Related

- Issue #1567 — Dependency vulnerability scanning (`npm audit`)
- `backend/src/analytics_service.ts` — `recordEvent`, `normalizeSorobanEvent`, `getEventStats`
- `backend/src/analytics_aggregator.ts` — `aggregatePlatformMetrics`, `aggregateUserMetrics`, `aggregateGroupMetrics`
- `frontend/src/lib/EventService.ts` — Soroban contract event types (`GroupCreated`, `ContributionMade`, `PayoutExecuted`, etc.)
