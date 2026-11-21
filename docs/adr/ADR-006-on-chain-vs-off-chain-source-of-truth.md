# ADR-006: On-Chain vs Off-Chain Source of Truth

**Status**: Proposed  
**Date**: 2026-10-19  
**Author**: Stellar-Save Contributors  
**Deciders**: Architecture Team

## Context

Stellar-Save reads and writes entity state in two places:

1. **On-chain** — Soroban smart contracts (`contracts/stellar-save/src/`) store financial state directly on the Stellar ledger.
2. **Off-chain** — A PostgreSQL database, populated by the backend's `ContractEventIndexer`, stores a queryable replica of on-chain events plus application-only state (notifications, preferences, admin actions, etc.).

The frontend (`frontend/src/utils/`) communicates exclusively with the backend REST API; it never invokes Soroban contracts directly. Some frontend API layers are still stubbed with mock data (e.g., `groupApi.ts` returns `MOCK_GROUPS` and has `TODO: replace stubs with actual Soroban contract invocations`).

Without a recorded decision on which side is authoritative for each entity, contributors have made inconsistent choices:

- Some backend routes query Prisma; others invoke the indexer.
- The frontend `groupApi.ts` uses mock data instead of the backend REST API that already exposes indexed events.
- Insurance and governance state lives only in the backend (in-memory or Prisma) with no on-chain counterpart yet.

This ADR records the authoritative source for every entity and the reconciliation strategy that keeps the off-chain replica consistent.

### Alternatives Considered

1. **Pure on-chain queries** — The frontend calls Soroban directly via `@stellar/stellar-sdk`.
   - Simple architecture, single source of truth.
   - Rejected in ADR-003: too slow (1–5 s per query), no aggregation support, and Horizon rate limits block concurrent users.

2. **Pure off-chain database** — All state lives in Postgres; the contract is a thin settlement layer.
   - Faster queries, familiar SQL.
   - Rejected: violates the decentralisation guarantee. Users must be able to verify balances and payouts on-chain without trusting the backend.

3. **Hybrid with a declared authority per entity** _(chosen)_ — Financial state is authoritative on-chain; the backend indexes it for performance. Application-only state (notifications, admin, preferences) lives solely off-chain.

## Decision

**Each entity has exactly one authoritative source. The backend indexes on-chain entities for read performance but never invents financial state that the ledger does not contain.**

### Entity Inventory

| Entity | Created | Authoritative Source | Read path (frontend → backend → ?) | Notes |
|---|---|---|---|---|
| **Group** | On-chain (`create_group`) | Soroban contract | Frontend → REST `/api/v1/events` → Postgres (indexed `GroupCreated` events) | `groupApi.ts` stubs must be replaced with REST calls |
| **Member** | On-chain (`add_member` / join) | Soroban contract | Frontend → REST → Postgres (indexed `MemberJoined` events) | `MemberProfile` stored under `StorageKey::MbrProf` |
| **Contribution** | On-chain (`contribute`) | Soroban contract | Frontend → REST `/api/v1/events` → Postgres (indexed `ContributionMade`) | Per-cycle tracking via `StorageKey::Contrib`, `CycTotal`, `CycCount` |
| **Payout** | On-chain (`execute_payout`) | Soroban contract | Frontend → REST `/api/v1/events` → Postgres (indexed `PayoutExecuted`) | `PayoutRecord` under `StorageKey::Payout`; schedule under `StorageKey::PayRecip` |
| **Group Status** | On-chain | Soroban contract | Frontend → REST → Postgres (indexed `GroupStatusChanged`) | Enum: Pending → Active → Paused → Completed / Cancelled |
| **Insurance Pool** | Off-chain (backend) | Postgres | Frontend → REST `/api/v1/groups/:groupId/insurance` → Postgres | In-memory demo in `insurance.ts`; no on-chain counterpart yet |
| **Insurance Claim** | Off-chain (backend) | Postgres | Same as above | Future: settle claims on-chain |
| **Governance Proposal** | Off-chain (backend) | Postgres | Frontend → REST `/api/v1/governance/proposals` → in-memory store | `governance.ts` uses in-memory arrays; future: on-chain governance module |
| **Governance Vote** | Off-chain (backend) | Postgres | Same as above | Validated by governor list in backend |
| **Notification** | Off-chain only | Postgres | Frontend → REST `/api/v1/notifications/*` → Postgres + push providers | No on-chain representation; purely application-level |
| **User Preferences** | Off-chain only | Postgres | Frontend → REST `/api/user/:wallet/preferences` → Postgres | App settings, not financial state |
| **Webhook** | Off-chain only | Postgres | Frontend → REST `/api/webhooks` → Postgres | Integrator configuration |
| **Admin Actions** | Off-chain only | Postgres | Admin UI → REST `/api/v1/admin/*` → Postgres | Audit log in `AdminService` |
| **KYC Status** | Off-chain only | Postgres | Frontend → REST `/api/kyc/*` → Postgres + external KYC provider | Regulatory data; never stored on-chain |
| **Reputation Score** | Off-chain (derived) | Postgres | Frontend → REST `/api/members/:address/reputation` → computed from indexed events | Derived from on-chain contribution history |

## Rationale

### 1. Financial State Must Be On-Chain Authoritative

Groups, members, contributions, and payouts involve real money (XLM, USDC). Users and auditors must be able to verify these independently via Stellar explorers. The Soroban contract is the settlement layer and therefore the single source of truth.

### 2. The Event Indexer Is a Read-Optimized Cache

`ContractEventIndexer` subscribes to Soroban events via the Horizon streaming API and writes them into Postgres. This gives the backend:

- Sub-100 ms queries vs 1–5 s on-chain (see ADR-003)
- Aggregation, pagination, and full-text search
- Analytics and reporting

The indexed data is **eventually consistent** with the ledger. The indexer's lag is typically < 10 seconds (one Stellar ledger close).

### 3. Application State Stays Off-Chain

Notifications, preferences, webhooks, admin actions, and KYC data have no financial significance and no reason to occupy ledger storage. They live solely in Postgres.

### 4. Insurance and Governance Are Transitional

Both modules currently live off-chain (backend in-memory or Prisma). The contract already has a `governance` module directory and insurance-related test files, signalling intent to move these on-chain. Until that migration, the backend is authoritative for these entities.

## Reconciliation Strategy

```
Soroban Contract
      │
      │ emits events (GroupCreated, MemberJoined, ContributionMade, PayoutExecuted, …)
      ▼
ContractEventIndexer (backend/src/contract_event_indexer.ts)
      │
      │ writes indexed rows
      ▼
PostgreSQL (Prisma)
      │
      │ serves queries
      ▼
REST API → Frontend
```

1. **Writes** always go through the Soroban contract (via the frontend's wallet signer or the backend's admin key for operational actions).
2. **Events** emitted by the contract are captured by `ContractEventIndexer` and persisted in Postgres.
3. **Reads** go through the REST API, which queries Postgres.
4. **Consistency check**: The backend `schema:check` script (`jest src/tests/schema-snapshot.test.ts`) validates that the GraphQL schema (which mirrors Prisma) stays in sync with the expected shape.
5. **Divergence detection**: If the indexer falls behind, the `/readyz` probe reports `not_ready` and the readiness gate prevents traffic from reaching stale data.

### Known Divergences

| Divergence | Impact | Resolution |
|---|---|---|
| Frontend `groupApi.ts` returns mock data instead of calling the backend | Users see fabricated groups | Replace stubs with `api.get('/v1/events?eventType=GroupCreated')` calls |
| Insurance pool state is in-memory only (`insurance.ts`) | Data lost on restart | Persist to Prisma; future: move to on-chain module |
| Governance proposals are in-memory only (`governance.ts`) | Data lost on restart | Persist to Prisma; future: move to on-chain governance module in `contracts/stellar-save/src/governance/` |
| Reputation score is derived at query time | Minor: scores could diverge if indexer lags | Acceptable; scores are advisory, not financial |

## Consequences

### Positive

- ✅ Clear ownership: contributors know where to read and write each entity
- ✅ Financial state is independently verifiable on-chain
- ✅ Backend remains a fast, queryable read replica
- ✅ Application-only state avoids unnecessary on-chain storage costs
- ✅ Path is clear for insurance and governance to migrate on-chain

### Negative

- ❌ Eventual consistency means reads can lag by ~1 ledger close (~5 s)
- ❌ Two codebases must agree on entity shapes (Rust types ↔ Prisma schema)
- ❌ Mock stubs in the frontend mask the real data flow and must be replaced

### Mitigation

- Readiness probe gates traffic when the indexer is behind
- `schema:check` CI step catches Prisma ↔ contract shape drift
- Frontend stub replacement is tracked separately

## Implementation Notes

- No code change is required for this ADR; it records the existing (implicit) architecture.
- Frontend stub replacement should follow: swap `groupApi.ts` mock data with calls to the backend REST API.
- Insurance and governance persistence should be tracked as separate issues.

## Related Decisions

- [ADR-001: Choice of Soroban](./ADR-001-soroban-platform-choice.md) — why Soroban is the on-chain platform
- [ADR-003: Backend Event Indexing](./ADR-003-event-indexing-approach.md) — why the indexer exists and its performance characteristics
- [ADR-004: Contract Module Boundaries](./ADR-004-contract-module-boundaries.md) — how the contract is structured
- Issue #13: Frontend API layer completion
- Issue #36: Define Group struct (closed — the on-chain `Group` struct)
- Issue #61: Data reconciliation strategy

## References

- [Soroban Events](https://soroban.stellar.org/docs/learn/events)
- [Stellar Horizon Streaming](https://developers.stellar.org/docs/data/horizon/api-reference/streaming)
- `backend/src/contract_event_indexer.ts` — the indexer implementation
- `contracts/stellar-save/src/storage.rs` — on-chain storage key layout
- `frontend/src/utils/groupApi.ts` — current (stubbed) frontend read path
