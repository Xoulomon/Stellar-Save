# Chaos Engineering Runbook — Stellar-Save

**Purpose:** Document all chaos experiments defined for the staging environment,
their expected behaviours, pass criteria, and remediation steps when they expose
real weaknesses.

**Ownership:** DevOps / Platform team  
**Review cadence:** After every chaos run or when SLO thresholds change  
**Related workflow:** `.github/workflows/chaos.yml`  
**Experiment definitions:** `chaos/experiments.json`

---

## How to Run

```bash
# Dry-run all experiments (prints steps, no side-effects)
CHAOS_DRY_RUN=true node chaos/runner.js all

# Run a single experiment
BACKEND_URL=https://staging.stellar-save.app node chaos/runner.js soroban-rpc-outage

# Run from GitHub Actions manually
# → Actions tab → Chaos Engineering → Run workflow
```

Required environment variables:

| Variable | Required for |
|----------|-------------|
| `BACKEND_URL` | All experiments |
| `STELLAR_RPC_URL` | soroban-rpc-outage |
| `REDIS_URL` | redis-eviction |
| `DATABASE_URL` | db-latency-injection (indirect) |

---

## Experiment 1 — Soroban RPC Outage

**ID:** `soroban-rpc-outage`  
**Category:** Network fault  
**Duration:** 60 seconds blackout

### What it does
Drops all outbound packets to the Soroban RPC endpoint (via `iptables`) for 60 seconds,
then restores connectivity and asserts recovery within 30 seconds.

### Expected behaviour
- Backend returns `HTTP 503` with a `Retry-After` header on contract-interaction endpoints.
- Health endpoint (`/health`) continues to return `200` (DB + basic checks do not depend on RPC).
- Node process does not crash.
- After network is restored, the service resumes automatically — no restart required.
- All errors are logged with `correlationId` and `service` fields.

### Pass criteria
| Criterion | Threshold |
|-----------|-----------|
| Process alive during outage | ✅ required |
| `/health` returns 200 or 503 | ✅ required |
| Recovery after restore | ≤ 30s |
| Structured error logs | ✅ required |

### If it fails
**Symptom:** Process crashes or does not recover.  
**Investigation:**
1. Check backend logs: `aws logs tail /aws/stellar-save/staging/app --follow`
2. Look for unhandled promise rejections on RPC calls in `contract_event_indexer.ts`
3. Confirm the soroban client call is wrapped in try/catch with graceful fallback

**Remediation:**
- Add circuit-breaker pattern around Soroban RPC calls
- Ensure all contract interaction routes return 503 (not 500) on RPC failure
- Add `retry-after: 30` header in the error response middleware

---

## Experiment 2 — Database Latency Injection

**ID:** `db-latency-injection`  
**Category:** Latency  
**Duration:** 90 seconds injection

### What it does
Uses `tc netem` to add 500ms ± 50ms jitter on all traffic destined for port 5432 for 90 seconds.
Simultaneously runs a benchmark at 10 rps and asserts p95 < 5000ms.

### Expected behaviour
- API p95 latency rises in proportion to DB latency (expected p95 ~1000–2000ms).
- Requests complete (slowly) — no mass timeouts.
- Connection pool does not exhaust (max connections not exceeded).
- Latency returns to normal within 30s of injection removal.

### Pass criteria
| Criterion | Threshold |
|-----------|-----------|
| API p95 latency during injection | ≤ 5000ms |
| 5xx error rate during injection | < 5% |
| Latency recovery after injection | ≤ 30s |

### If it fails
**Symptom:** p95 exceeds 5000ms or connection pool errors.  
**Investigation:**
1. Check `pg` pool configuration in `backend/src/prisma_client.ts`
2. Look for missing database query timeouts in Prisma client config
3. Check if read-heavy routes are missing cache fallback

**Remediation:**
- Set `statement_timeout` on the Prisma client connection: `{ "statement_timeout": 4000 }`
- Enable connection pool size limit: `connection_limit=20` in DATABASE_URL
- Add `stale-while-revalidate` caching for read endpoints that can tolerate slightly stale data

---

## Experiment 3 — Redis Cache Eviction

**ID:** `redis-eviction`  
**Category:** State fault  
**Duration:** Instant (FLUSHDB)

### What it does
Runs `FLUSHDB` against the staging Redis instance, immediately evicting all cached keys.
Then fires 20 sequential requests to `/api/v1/groups` and asserts all succeed.

### Expected behaviour
- 100% cache-miss immediately after flush.
- All requests fall through to Postgres and succeed (no 5xx).
- Cache repopulates within 60 seconds as keys are re-read.

### Pass criteria
| Criterion | Threshold |
|-----------|-----------|
| Success rate (20 requests post-flush) | ≥ 99% |
| No 5xx errors | ✅ required |
| Cache hit rate recovery | > 50% within 60s |

### If it fails
**Symptom:** 5xx errors immediately after flush.  
**Investigation:**
1. Check if code assumes cache key always exists (missing null-check on `redis.get`)
2. Verify DB fallback in `backend/src/lib/cache.ts` `getOrSet` function

**Remediation:**
- All `redis.get()` calls must handle `null` return and fall back to DB
- Never throw on cache miss — log `warn` and continue
- Use the `getOrSet(key, fn, ttl)` helper everywhere instead of raw `get/set`

---

## Experiment 4 — Worker Process Crash

**ID:** `worker-crash`  
**Category:** Process fault  
**Duration:** Instant (SIGKILL)

### What it does
Sends `SIGKILL` to the backend Node.js process.  ECS / process manager must restart it.
Asserts the service is healthy within 30 seconds and data integrity is intact.

### Expected behaviour
- In-flight requests fail with 502 at the load balancer level (not silent drop).
- ECS replaces the task within its health-check interval (≤ 30s for staging).
- After restart, `/health` returns 200.
- Groups and members data in Postgres is unaffected.

### Pass criteria
| Criterion | Threshold |
|-----------|-----------|
| Service healthy after restart | ≤ 30s |
| No data corruption | ✅ required |
| In-flight requests fail with 502 | ✅ required |

### If it fails
**Symptom:** Service does not restart within 30 seconds.  
**Investigation:**
1. Check ECS task definition — ensure `healthCheck` is configured with short intervals
2. Review ECS service `minimumHealthyPercent` and `desiredCount`
3. Confirm no `SIGKILL` handler is blocking shutdown

**Remediation:**
- Set ECS health-check: `interval: 10s, retries: 3, startPeriod: 30s`
- Ensure `desiredCount >= 1` and the service has restart policy enabled
- Add graceful shutdown handler for `SIGTERM` (but SIGKILL is non-catchable by design)

---

## Interpreting Results

After each chaos run, the GitHub Actions summary page shows a table with pass/fail per experiment.
The full structured logs are in CloudWatch:

```
# Trace all log lines for a chaos run (correlationId starts with "drill-")
aws logs insights query \
  --log-group-name /aws/stellar-save/staging/app \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string 'fields @timestamp, message, level, correlationId | filter correlationId like /drill-/ | sort @timestamp asc'
```

## Adding New Experiments

1. Add a new entry to `chaos/experiments.json` following the existing schema.
2. Implement any new `action` types in `chaos/runner.js` under the `executeStep` switch.
3. Add a corresponding job to `.github/workflows/chaos.yml`.
4. Document it in this runbook.
5. Run in dry-run mode first: `CHAOS_DRY_RUN=true node chaos/runner.js <new-id>`

## SLO Baseline

| Metric | Normal | Degraded (acceptable) | Failed |
|--------|--------|----------------------|--------|
| API p95 latency | < 200ms | < 5000ms | ≥ 5000ms |
| Error rate | < 0.1% | < 5% | ≥ 5% |
| Recovery time | N/A | ≤ 30s | > 30s |
| Process uptime | 99.9% | 99% | < 99% |
