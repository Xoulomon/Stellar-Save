# Load Tests — Concurrent Deposit Requests

This directory contains [k6](https://k6.io/) load test scenarios for the
Stellar-Save backend/staging API. The primary scenario verifies that concurrent
deposit (contribution) requests do not cause balance drift or lost updates.

---

## Scenarios

| File | Purpose |
|------|---------|
| `concurrent-deposits.js` | Simulates concurrent deposit load; asserts final balances |
| `balance-assertions.js` | Shared helpers for balance integrity checks |

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
docker run --rm -i grafana/k6 run - < backend/tests/load/concurrent-deposits.js
```

---

## Running the Tests

### Quick smoke run (local mock server)

Start a local stub or the actual backend on port 3000, then:

```bash
k6 run backend/tests/load/concurrent-deposits.js
```

This uses the defaults:
- `BASE_URL=http://localhost:3000`
- 20 virtual users (members)
- 1 XLM (10 000 000 stroops) per contribution

### Against staging

```bash
BASE_URL=https://staging.stellar-save.example.com \
RPC_URL=https://soroban-testnet.stellar.org \
GROUP_ID=<your-staging-group-id> \
VU_COUNT=50 \
k6 run backend/tests/load/concurrent-deposits.js
```

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_URL` | `http://localhost:3000` | API base URL |
| `RPC_URL` | `https://soroban-testnet.stellar.org` | Stellar RPC for on-chain verification |
| `GROUP_ID` | `test-group-load-001` | Group ID to deposit into |
| `VU_COUNT` | `20` | Number of concurrent virtual users |
| `CONTRIBUTION_STROOPS` | `10000000` | Contribution amount per deposit (1 XLM) |

---

## Acceptance Criteria Mapping

| Criterion | How it is tested |
|-----------|-----------------|
| Load scenario added | `concurrent-deposits.js` implements two scenarios: `concurrent_deposit_burst` (ramp to N VUs) and `sustained_baseline` (constant 5 VUs) |
| No balance drift under load | `teardown()` fetches post-test balance, computes expected value, and records drift via the `balance_drift_stroops` Gauge. The threshold `value==0` fails the test if any drift is detected |
| Tested (load) | Thresholds enforce p(99) < 5 s, error rate < 1 %, and zero balance drift |

---

## Thresholds (pass/fail criteria)

| Metric | Threshold | Meaning |
|--------|-----------|---------|
| `deposit_duration_ms` | `p(99) < 5000` | 99th percentile deposit RTT under 5 s |
| `deposit_error_rate` | `rate < 0.01` | Less than 1 % of deposits error |
| `balance_drift_stroops` | `value == 0` | **Zero** balance drift — all accepted deposits must be reflected in the final balance |
| `http_req_failed` | `rate < 0.01` | Less than 1 % of all HTTP requests fail |
| `http_req_duration` | `p(95) < 3000` | 95th percentile HTTP RTT under 3 s |

A non-zero `balance_drift_stroops` value means the server lost or double-counted
at least one deposit, which is a **P1 race condition bug**.

---

## Interpreting Results

### Healthy run output

```
✓ deposit: status is 200 or 202
✓ deposit: response has tx_hash or accepted
✓ deposit: no error field

[teardown] ✅ PASS — no balance drift detected
[teardown] Initial balance   : 0 stroops
[teardown] Accepted deposits : 584
[teardown] Expected balance  : 5840000000 stroops
[teardown] Actual balance    : 5840000000 stroops
[teardown] Drift             : 0 stroops

  ✓ balance_drift_stroops.............: 0
  ✓ deposit_duration_ms...............: p(99)=1243ms
  ✓ deposit_error_rate................: 0.00%
```

### Race condition detected

```
[teardown] ❌ FAIL — balance drift of 20000000 stroops detected.
           2 contribution(s) may have been lost or double-counted.

  ✗ balance_drift_stroops.............: 20000000
```

When this occurs:
1. Capture the k6 JSON output: `k6 run --out json=results.json ...`
2. Examine which VUs received errors vs. success responses
3. Cross-reference on-chain ledger entries via the Stellar testnet explorer
4. Check for missing database transactions or optimistic concurrency violations

---

## CI Integration

Add to your CI pipeline after the staging deploy:

```yaml
- name: Run concurrent deposit load test
  run: |
    k6 run \
      --out json=load-test-results.json \
      --env BASE_URL=${{ env.STAGING_URL }} \
      --env GROUP_ID=${{ env.STAGING_GROUP_ID }} \
      backend/tests/load/concurrent-deposits.js

- name: Upload load test results
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: load-test-results
    path: load-test-results.json
    retention-days: 30
```

---

## Staging Setup Notes

1. **Create a dedicated test group** on the staging contract before running:
   ```bash
   stellar contract invoke \
     --id $CONTRACT_ID \
     --network testnet \
     --source deployer \
     -- create_group \
     --name "Load Test Group" \
     --contribution_amount 10000000 \
     --max_members 100 \
     --cycle_duration 3600
   ```

2. **Fund test accounts** with sufficient XLM to cover contributions:
   ```bash
   # Each VU needs at least contribution_amount + tx fees
   stellar account fund $TEST_ADDRESS --network testnet
   ```

3. **Record the Group ID** from the `create_group` response and pass it
   as `GROUP_ID` to k6.

4. **Reset between runs** by checking the group's cycle state. If the cycle
   is complete and a payout has occurred, the balance will be 0 at the start
   of the next cycle — that is expected and not drift.
