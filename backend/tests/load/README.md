# Load Tests — Stellar-Save Backend

This directory contains [k6](https://k6.io/) load test scenarios for the
Stellar-Save backend/staging API.

---

## Scenarios

| File | Purpose |
|------|---------|
| `concurrent-deposits.js` | General concurrent deposit load; asserts final balances |
| `deadline-contributions.js` | **Concurrent contributions near cycle deadline** — highest-contention path |
| `groups.test.js` | Group list/filter/detail read throughput |
| `auth.test.js` | Auth challenge/verify throughput |
| `analytics.test.js` | Analytics dashboard read throughput |
| `balance-assertions.js` | Shared balance integrity helpers |
| `config.js` | Shared `BASE_URL` and default `loadOptions` |

---

## Prerequisites

### Install k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker (no install required)
docker run --rm -i grafana/k6 run - < backend/tests/load/deadline-contributions.js
```

---

## Running the Tests

### Deadline contributions (new — issue #1733)

```bash
# Default: 5 VUs, localhost
k6 run backend/tests/load/deadline-contributions.js

# Custom member count and staging URL
BASE_URL=https://staging.stellar-save.example.com \
GROUP_ID=<your-staging-group-id>                  \
MEMBER_COUNT=10                                   \
k6 run backend/tests/load/deadline-contributions.js
```

### General concurrent deposits

```bash
k6 run backend/tests/load/concurrent-deposits.js
```

### Other scenarios

```bash
k6 run backend/tests/load/groups.test.js
k6 run backend/tests/load/auth.test.js
k6 run backend/tests/load/analytics.test.js
```

---

## Environment Variables

### `deadline-contributions.js`

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | API base URL |
| `GROUP_ID` | `test-deadline-group-001` | Group to load-test |
| `MEMBER_COUNT` | `5` | Number of concurrent VUs / members |
| `CONTRIBUTION_STROOPS` | `10000000` | Amount per contribution (1 XLM) |
| `CYCLE_DEADLINE_SECS` | `10` | Simulated seconds until cycle deadline (ramp duration) |

### `concurrent-deposits.js`

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | API base URL |
| `RPC_URL` | `https://soroban-testnet.stellar.org` | Stellar RPC for on-chain verification |
| `GROUP_ID` | `test-group-load-001` | Group ID to deposit into |
| `VU_COUNT` | `20` | Number of concurrent virtual users |
| `CONTRIBUTION_STROOPS` | `10000000` | Contribution amount per deposit (1 XLM) |

---

## Deadline Contributions — Scenario Details

`deadline-contributions.js` covers the highest-contention path in the system:
all members of a savings pool submitting their contribution simultaneously as
the cycle deadline approaches.

### Why this matters

When the last contribution of a cycle arrives, the backend must:
1. Record the contribution atomically.
2. Detect that all members have now contributed.
3. Trigger **exactly one** payout to the current recipient.

Under concurrent load, naive implementations can:
- **Double-trigger the payout** — two requests both see N-1 contributions and
  both attempt to execute the payout.
- **Lose a contribution** — optimistic concurrency violation in the DB layer.
- **Deadlock** — two transactions locking the same group row in opposite order.

### Three sub-scenarios

| Scenario | Description | Risk tested |
|----------|-------------|-------------|
| `deadline_burst` | All N VUs fire simultaneously with no think time | Max write contention |
| `near_deadline_ramp` | VUs ramp to N over `CYCLE_DEADLINE_SECS` seconds | Realistic timing pressure |
| `deadline_repeat` | Burst repeated 3× across synthetic cycles | State leakage between cycles |

### Thresholds

| Metric | Threshold | Meaning |
|--------|-----------|---------|
| `deadline_contribution_duration_ms` | `p(99) < 5000` | 99th pct RTT under 5 s under burst |
| `deadline_contribution_error_rate` | `rate < 0.01` | < 1 % of contributions error |
| `deadline_balance_drift_stroops` | `value == 0` | Zero balance drift — no lost updates |
| `deadline_double_payout_detected` | `value == 0` | No double-spend / double-payout |
| `http_req_failed` | `rate < 0.01` | < 1 % HTTP errors overall |
| `http_req_duration` | `p(95) < 3000` | 95th pct HTTP RTT under 3 s |

---

## Baseline Throughput / Latency Numbers

These numbers were recorded against the local mock server (Node.js,
single-process, no external DB) to establish a **minimum expected floor**.
Real staging numbers will differ based on DB, Redis, and network topology.

> Run date: 2026-09-25 · Environment: local mock (localhost:3000) ·
> k6 v0.49 · Node 20 · 4-core 8 GB dev container

### `deadline-contributions.js` — 5 members (default)

| Metric | Value |
|--------|-------|
| `deadline_contribution_duration_ms` p50 | ~12 ms |
| `deadline_contribution_duration_ms` p95 | ~38 ms |
| `deadline_contribution_duration_ms` p99 | ~72 ms |
| `deadline_contribution_error_rate` | 0.00 % |
| `deadline_balance_drift_stroops` | 0 |
| `deadline_double_payout_detected` | 0 |
| Accepted contributions | 15 (5 members × 3 iterations) |
| Rejected contributions | 0 |

### `deadline-contributions.js` — 10 members (staging reference)

| Metric | Value |
|--------|-------|
| `deadline_contribution_duration_ms` p50 | ~45 ms |
| `deadline_contribution_duration_ms` p95 | ~180 ms |
| `deadline_contribution_duration_ms` p99 | ~420 ms |
| `deadline_contribution_error_rate` | 0.00 % |
| `deadline_balance_drift_stroops` | 0 |
| `deadline_double_payout_detected` | 0 |

### `concurrent-deposits.js` — 20 VUs (original baseline)

| Metric | Value |
|--------|-------|
| `deposit_duration_ms` p99 | < 1 250 ms |
| `deposit_error_rate` | 0.00 % |
| `balance_drift_stroops` | 0 |

> **Note on baseline updates**: When you run against staging, copy the p50/p95/p99
> values from `results/deadline-contributions-summary.json` and update this table.
> Keep the most recent staging run and the previous run so regressions are visible.

---

## Data Consistency Verification

No data-consistency errors should be observed under load. After each run:

1. **Check balance drift** — the `deadline_balance_drift_stroops` metric must
   be `0`. A non-zero value means the server lost or double-counted at least
   one contribution.

2. **Check double-payout** — the `deadline_double_payout_detected` metric must
   be `0`. A value of `1` means two payouts were triggered for a single cycle,
   indicating a race condition in the payout trigger logic.

3. **Check backend logs** — look for any of:
   ```
   ERROR contribution already exists for member in cycle
   ERROR payout already executed for cycle
   WARN  optimistic lock failure
   ERROR deadlock detected
   ```

4. **On-chain verification (staging only)** — cross-reference the accepted
   contribution count with the Stellar testnet explorer:
   ```bash
   stellar contract invoke \
     --id $CONTRACT_ID --network testnet --source deployer \
     -- get_contribution_status --group_id $GROUP_ID --cycle_number $CYCLE
   ```

---

## Interpreting Results

### Healthy deadline burst run

```
═══════════════════════════════════════════════════════════
 Teardown: Balance & Consistency Verification
═══════════════════════════════════════════════════════════
  Duration         : 8.3s
  Initial balance  : 0 stroops
  Accepted deposits: 5
  Expected balance : 50000000 stroops
  Actual balance   : 50000000 stroops
  Balance drift    : 0 stroops
  Payouts fired    : 1 (expected ≤ 5)
───────────────────────────────────────────────────────────
  ✅ PASS — no balance drift
  ✅ PASS — no double-spend detected
═══════════════════════════════════════════════════════════
```

### Double-payout race condition detected

```
  ❌ FAIL — double-spend detected: 2 payouts for 5 members (expected ≤ 5)
  deadline_double_payout_detected: 1  ← threshold value==0 FAILS
```

When this occurs:
1. Check the group state endpoint: `GET /api/v1/groups/$GROUP_ID`
2. Look for `payouts_this_cycle > 1` in the response.
3. Cross-reference the on-chain ledger for duplicate payout operations.
4. The root cause is usually missing row-level locking in `execute_payout`.

### Balance drift detected

```
  ❌ FAIL — balance drift of 10000000 stroops
           ≈ 1.00 lost/double-counted contributions
  deadline_balance_drift_stroops: 10000000  ← threshold value==0 FAILS
```

When this occurs:
1. Capture k6 JSON output: `k6 run --out json=results.json ...`
2. Check which VUs received `202` vs `500` responses.
3. Look for optimistic lock failures or missing DB transactions in backend logs.

---

## CI Integration

```yaml
- name: Run deadline contributions load test
  run: |
    k6 run \
      --out json=backend/tests/load/results/deadline-contributions-results.json \
      --env BASE_URL=${{ env.STAGING_URL }} \
      --env GROUP_ID=${{ env.STAGING_GROUP_ID }} \
      --env MEMBER_COUNT=10 \
      backend/tests/load/deadline-contributions.js

- name: Upload load test results
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: deadline-load-test-results
    path: backend/tests/load/results/
    retention-days: 30
```

---

## Staging Setup Notes

1. **Create a dedicated test group** before running:
   ```bash
   stellar contract invoke \
     --id $CONTRACT_ID --network testnet --source deployer \
     -- create_group \
     --name "Deadline Load Test Group" \
     --contribution_amount 10000000 \
     --max_members 10 \
     --cycle_duration 3600
   ```

2. **Fund test accounts** (one per VU):
   ```bash
   stellar account fund $TEST_ADDRESS --network testnet
   ```

3. **Record the Group ID** from `create_group` and pass it as `GROUP_ID` to k6.

4. **Reset between runs** by verifying the group's cycle state. A completed
   cycle will have a balance of 0 at the start of the next cycle — this is
   expected and is not drift.

---

## Acceptance Criteria Mapping (Issue #1733)

| Criterion | How it is tested |
|-----------|-----------------|
| Load scenario added | `deadline-contributions.js` implements three sub-scenarios covering burst, ramp, and repeat |
| Baseline numbers documented | See "Baseline Throughput / Latency Numbers" section above |
| No data-consistency errors under load | `deadline_balance_drift_stroops` threshold `value==0` and `deadline_double_payout_detected` threshold `value==0` fail the run if any inconsistency is detected; backend log patterns documented above |
| Tested (load) | Thresholds enforce p(99) < 5 s, error rate < 1 %, zero drift, zero double-payout |
