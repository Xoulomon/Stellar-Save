# Performance Tuning and Scaling Guide

This guide documents the scaling characteristics of Stellar-Save and the practical tuning levers that operators and contributors can use to keep the system responsive.

## Architecture overview

Stellar-Save uses three main layers that affect throughput and latency:

1. The Stellar Soroban contract, which stores group state and executes core financial operations.
2. The backend services, which expose APIs and process analytics, notifications, and indexing work.
3. The event indexer and cache layer, which reduce repeated reads and keep dashboards up to date.

The main scaling concerns are therefore:

- contract gas usage and storage growth
- backend cache hit rate and request latency
- indexer throughput and event backlog
- database read/write pressure and connection saturation

## Caching strategy and invalidation model

### Backend cache layers

The backend uses Redis-backed caching for analytics and API responses. The cache helpers in [backend/src/redis.ts](../backend/src/redis.ts) and [backend/src/analytics_middleware.ts](../backend/src/analytics_middleware.ts) provide the basic primitives:

- `get` and `set` for TTL-based key/value caching
- `del`/`delPattern` for targeted invalidation
- middleware that caches read-heavy analytics endpoints for a fixed TTL

Typical TTLs in the current implementation:

| Use case | TTL |
|---|---:|
| General analytics cache | 1 hour |
| Landing-page stats cache | 5 minutes |
| Contract state cache entries | configurable, short-lived |

### Invalidation rules

Cache entries should be invalidated when state-changing events occur. The contract event indexer is wired to invalidate relevant backend cache entries when mutation events are processed, as shown in [backend/src/contract_event_indexer.ts](../backend/src/contract_event_indexer.ts).

Recommended invalidation patterns:

- Invalidate per-group state when a contribution, payout, or membership event arrives.
- Invalidate contract-wide aggregates when a new group is created or a major state transition happens.
- Invalidate analytics caches after bulk writes or backfills.

## Database scaling and indexing

### Read/write pattern

The backend and analytics services depend on a relational database for transactional state and on the contract event indexer for on-chain history. For production deployments, the safest path is:

- keep the primary database for writes
- add read replicas for analytics dashboards and reporting workloads
- separate heavy reporting and bulk export jobs from the main application path

### Indexing throughput tuning

The event indexer should be tuned around three operational limits:

- ledger processing rate from the RPC endpoint
- database write throughput
- downstream notification and analytics fan-out costs

Recommended tuning steps:

1. Increase the indexer worker concurrency only if the database can sustain it.
2. Batch writes and commit in larger chunks where possible to reduce transaction overhead.
3. Throttle or queue backfills during peak hours so user-facing traffic is not starved.
4. Monitor the lag between the latest processed ledger and the current chain height.

### Capacity guidance

A practical starting point for a modest production deployment is:

- 1 primary database instance
- 1 read replica for dashboard/reporting traffic
- 1 Redis instance for API and analytics cache
- indexer workers sized to keep lag under a few minutes under normal conditions

## Contract gas characteristics and optimization patterns

The contract gas model is documented in [docs/performance-optimization.md](../docs/performance-optimization.md). The most important observations are:

- write-heavy operations such as `join_group` are the most expensive and should be treated as premium operations
- storage reads and writes dominate the cost profile
- payout and membership lookups are effectively O(1) when the reverse index is used

Optimization patterns that matter most:

- minimize redundant storage reads in a single invocation
- use compact types and avoid unnecessary storage keys
- keep group sizes bounded to reduce iteration overhead
- use the payout-position reverse index rather than scanning all members
- prefer batched or paginated reads for large lists

## Capacity planning from load-test results

The existing performance docs provide a useful baseline for capacity planning:

- a small group with 10 members and 10 cycles has a measured storage footprint in the low- to mid-kilobyte range
- storage grows roughly linearly with the number of members and cycles
- the dominant growth term comes from per-member contribution records

For planning purposes:

- assume the database and indexer will need to scale as the product of members × cycles grows
- plan for more aggressive cache invalidation and read replica capacity when analytics traffic increases
- set alert thresholds for contract event backlog, cache miss rate, and database replication lag

## Recommended operating thresholds

| Metric | Suggested alert threshold |
|---|---:|
| Redis cache hit rate | below 85% |
| Indexer ledger lag | above 5 minutes |
| Database CPU | above 70% sustained |
| API p95 latency | above 800 ms |
| Contract event backlog | growing continuously for 10+ minutes |

## Practical rollout checklist

- [ ] Confirm Redis is available and reachable from the backend.
- [ ] Enable cache invalidation for all state-mutating contract events.
- [ ] Add read-replica traffic splitting for analytics endpoints.
- [ ] Track indexer lag and backlog in monitoring.
- [ ] Run a load test before increasing the number of workers or replicas.
