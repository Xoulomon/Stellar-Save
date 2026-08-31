# Test Fixtures

This directory contains shared fixture factories for the backend test suite.
Each factory produces plain TypeScript objects — no database, no network — so
they can be used freely in unit tests, integration tests, and anywhere else a
realistic data seed is needed.

---

## `groups.ts` — GroupFixtureFactory

The `GroupFixtureFactory` provides builders for `Group`, `Member`, and
`Transaction` objects plus several composite helpers that return a fully-wired
`GroupFixture` snapshot.

### Types

```ts
interface GroupFixture {
  group: Group;             // The Group record
  members: Member[];        // All members (in payout-rotation order)
  transactions: Transaction[]; // Contribution (or payout) transactions for the cycle
  contributionStates: MemberContributionState[]; // Per-member paid/pending state
}

interface MemberContributionState {
  member: Member;
  hasContributed: boolean;
  transaction?: Transaction; // Present only when hasContributed is true
}
```

---

### Low-level builders

These return a single record. Use them when you need fine-grained control.

#### `buildGroup(overrides?)`

Returns a minimal `Group` with sensible defaults.

```ts
import { GroupFixtureFactory } from '../fixtures/groups';

// Default group: Active, 5 max members, 100 XLM/cycle, 1-week cadence
const group = GroupFixtureFactory.buildGroup();

// Override only what the test cares about
const highStakeGroup = GroupFixtureFactory.buildGroup({
  id: 'hs-001',
  name: 'High Stakes',
  contributionAmount: 5000,
  maxMembers: 3,
});
```

**Default values**

| Field               | Default          |
|---------------------|------------------|
| `id`                | `'grp-001'`      |
| `name`              | `'Test Savers'`  |
| `contributionAmount`| `100`            |
| `cycleDuration`     | `604800` (1 week)|
| `maxMembers`        | `5`              |
| `currentMembers`    | `0`              |
| `status`            | `'Active'`       |
| `tags`              | `['test']`       |

---

#### `buildMember(index?, overrides?)`

Returns a single `Member`. Pass a numeric `index` to generate distinct,
deterministic ids and Stellar addresses for bulk creation.

```ts
const alice = GroupFixtureFactory.buildMember(1, { name: 'Alice' });
const bob   = GroupFixtureFactory.buildMember(2, { name: 'Bob' });

// alice.address and bob.address are distinct, deterministic G… strings
```

---

#### `buildTransaction(groupId, member, txIndex, overrides?)`

Returns a single contribution `Transaction` linking a member to a group.

```ts
const tx = GroupFixtureFactory.buildTransaction('grp-001', alice, 1, {
  amount: 500,
});
// tx.type defaults to 'contribution'; override for payout records
```

---

### Composite builders

These return a full `GroupFixture` snapshot containing the group, its members,
and their contribution state for the current cycle.

---

#### `buildGroupWithMembers(memberCount, groupOverrides?)`

All `memberCount` members have contributed. Use this to test payout-trigger
logic or scenarios where the cycle is fully funded.

```ts
const { group, members, transactions, contributionStates } =
  GroupFixtureFactory.buildGroupWithMembers(6, {
    contributionAmount: 200,
    tags: ['monthly'],
  });

// group.currentMembers === 6
// group.maxMembers     === 6
// contributionStates.every(s => s.hasContributed) === true
```

---

#### `buildMixedContributionGroup(memberCount, contributedCount, groupOverrides?)`

The primary helper for mid-cycle scenarios. The first `contributedCount`
members have paid; the rest are still pending.

```ts
// 8 members total, 5 have paid, 3 are pending
const { group, contributionStates } =
  GroupFixtureFactory.buildMixedContributionGroup(8, 5, {
    id: 'cycle-mid',
  });

const paid    = contributionStates.filter(s => s.hasContributed);   // length 5
const pending = contributionStates.filter(s => !s.hasContributed);  // length 3

// Every paid state has a linked transaction
paid.forEach(s => {
  console.log(s.transaction!.stellarTxHash); // e.g. "HASHcycle-mid000001"
});
```

**Edge cases handled**

| `contributedCount` | Meaning                     |
|--------------------|-----------------------------|
| `0`                | Start of cycle, no payments |
| `memberCount - 1`  | One payment away from payout|
| `memberCount`      | Equivalent to `buildGroupWithMembers` |

---

#### `buildNearPayoutGroup(memberCount, groupOverrides?)`

Convenience alias: all members except the last have paid. Useful for testing
the final-contribution event that triggers a cycle payout.

```ts
const { contributionStates } =
  GroupFixtureFactory.buildNearPayoutGroup(5);

const pending = contributionStates.filter(s => !s.hasContributed);
// pending.length === 1
```

> Requires `memberCount ≥ 2`.

---

#### `buildCompletedGroup(memberCount, groupOverrides?)`

Returns a group in `'Completed'` status with one **payout** transaction per
member (the historical record after the full cycle has finished).

```ts
const { group, transactions } =
  GroupFixtureFactory.buildCompletedGroup(4, {
    contributionAmount: 500,
  });

// group.status === 'Completed'
// transactions.every(t => t.type === 'payout')       === true
// transactions.every(t => t.amount === 500 * 4)       === true
```

---

#### `buildPausedGroup(memberCount, contributedCount, groupOverrides?)`

Returns a group in `'Paused'` status. The `contributedCount` argument captures
how many members had paid before the pause was invoked.

```ts
const { group, contributionStates } =
  GroupFixtureFactory.buildPausedGroup(6, 3, { id: 'on-hold' });

// group.status === 'Paused'
// 3 members have transactions, 3 do not
```

---

#### `buildGroupList(count, groupOverrides?)`

Returns an array of `count` groups with unique ids and names. Useful for
testing list endpoints, pagination, and recommendation scoring.

```ts
const groups = GroupFixtureFactory.buildGroupList(10, {
  contributionAmount: 150,
});

// groups.length === 10
// new Set(groups.map(g => g.id)).size === 10  (all unique)
// groups.every(g => g.contributionAmount === 150)
```

---

### Integration test pattern

The recommended pattern is to build a fresh Express app per `describe` block
using `InMemoryGroupsRepository`. This keeps each scenario fully isolated.

```ts
import express from 'express';
import { GroupFixtureFactory } from '../fixtures/groups';
import { createGroupsRouter } from '../../src/routes/groups';
import { GroupsService } from '../../src/services/group/groups.service';
import { InMemoryGroupsRepository } from '../../src/services/group/groups.repository';
import { Group } from '../../src/models';
import request from 'supertest';

function buildTestApp(groups: Group[]) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createGroupsRouter(new GroupsService(new InMemoryGroupsRepository(groups)))
  );
  return app;
}

describe('near-payout scenario', () => {
  const { group } = GroupFixtureFactory.buildNearPayoutGroup(5, {
    id: 'np-001',
  });
  const app = buildTestApp([group]);

  it('returns 200', async () => {
    const res = await request(app).get('/api/groups/np-001');
    expect(res.status).toBe(200);
  });
});
```

See [`backend/test/integration/groups.test.ts`](../integration/groups.test.ts)
for the full example suite.

---

## `sep24.ts`

Exports `TEST_ACCOUNT`, a fixed Stellar test account address used in SEP-24
fiat-ramp integration tests.

```ts
import { TEST_ACCOUNT } from '../fixtures/sep24';
// 'GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3'
```

---

## Adding a new fixture file

1. Create `backend/test/fixtures/<domain>.ts`.
2. Export a named factory object (e.g. `MemberFixtureFactory`).
3. Keep every builder pure — no I/O, no global state.
4. Add a short section to this README under a new `##` heading.
