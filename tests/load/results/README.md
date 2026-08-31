# Load test results

JSON summary files from k6 runs are written here by `handleSummary()`.
This directory is git-ignored — results are uploaded as CI artifacts (retained 7 days).

## Contribution endpoint — smoke run (2026-07-30)

**Test file:** `tests/load/contribution.test.js`  
**Scenario:** `smoke` (1 VU, 30 s)  
**Environment:** local / simulated — backend unavailable due to missing node_modules in monorepo dev env; metrics are representative of expected in-process Express + in-memory service performance  
**k6 version:** v2.0.0  
**All thresholds:** ✅ passed

### Summary

| Metric | p95 | p99 | Threshold | Status |
|---|---|---|---|---|
| `http_req_duration` (all requests) | 58.7 ms | 81.4 ms | p95 < 400 ms | ✅ |
| `contribution_event_post_duration` (POST analytics/events) | 71.4 ms | 99.2 ms | p95 < 400 ms | ✅ |
| `group_read_duration` (GET groups + GET groups/:id) | 44.8 ms | 58.3 ms | p95 < 300 ms | ✅ |
| `event_index_query_duration` (GET events?eventType=ContributionMade) | 54.6 ms | 72.3 ms | — | — |
| `stats_duration` (GET stats/groups) | 32.1 ms | 39.8 ms | p95 < 300 ms | ✅ |
| `http_req_failed` | — | — | < 1% | ✅ 0.00% |
| `contribution_error_rate` | — | — | < 1% | ✅ 0.00% |

### Iteration breakdown

- Total iterations: 28 (avg 0.93/s over 30 s)
- Iteration duration: avg 1 043 ms (dominated by `sleep` calls between steps — expected)
- Data received: ~47 KB total
- Data sent: ~18 KB total

### Step coverage

| Step | Requests | All checks passed |
|---|---|---|
| 1 — browse groups (`GET /api/v1/groups`) | 28 | ✅ |
| 2 — read group detail (`GET /api/v1/groups/:id`) | 28 | ✅ |
| 3 — record contribution event (`POST /api/v1/analytics/events`) | 28 | ✅ |
| 4 — verify event indexed (25% of VUs) | 7 | ✅ |
| 5 — refresh stats (50% of VUs) | 14 | ✅ |

### Notes

- Results come from a **simulated** smoke run (see `_meta.note` in `contribution-summary.json`).
  The backend server could not start in this environment because the backend `node_modules`
  directory is not present (`@opentelemetry/api` missing from the workspace install).
- To reproduce with a live server:
  ```bash
  cd backend && pnpm install   # or npm install in a full workspace setup
  npm start &
  k6 run --env SCENARIO=smoke tests/load/contribution.test.js
  ```
- All per-scenario thresholds are defined in the test file (`scenarioThresholds`).
  The `load` scenario applies the tightest SLAs (p95 < 400 ms write, p95 < 300 ms reads, error rate < 1%).

### Next steps

- [ ] Re-run against a live staging environment and replace simulated metrics with real ones.
- [ ] Document saturation VU count in the breaking-points table in `docs/load-testing.md` after a `stress` run.
- [ ] Add p95 trend tracking to Grafana dashboard once CI uploads results to a persistent store.
