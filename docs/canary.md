# Canary Deployment

Canary deployment lets you roll out a new contract version to a small percentage of traffic, observe it for errors, then gradually promote it — or automatically roll back if health checks fail.

## How it works

```
Deploy canary (10%) → Monitor → Step up (25% → 50% → 100%) → Promote to stable
                                    ↓ failure at any step
                               Auto-rollback (0% canary)
```

Two contract IDs are tracked in `deployment-records/active.json`:

| Field | Description |
|---|---|
| `stable_contract_id` | Current production contract |
| `canary_contract_id` | New version under test |
| `canary_weight` | % of traffic routed to canary |
| `status` | `canary` / `stable` / `rolled_back` / `promoted` |

Clients read this registry and route requests using `scripts/canary_traffic.sh`.

## Configuration

Edit `canary.toml` to tune thresholds and promotion steps:

```toml
[canary]
traffic_weight = 10          # initial canary %

[thresholds]
max_error_rate = 5.0         # % errors before rollback
min_sample_size = 10         # min checks before verdict
max_consecutive_failures = 3 # consecutive failures before rollback

[promotion]
steps = [10, 25, 50, 100]    # traffic % steps
step_interval_seconds = 300  # wait between steps
```

## Scripts

| Script | Purpose |
|---|---|
| `canary_deploy.sh` | Deploy new WASM as canary alongside stable |
| `canary_traffic.sh` | Route a request to stable or canary |
| `canary_monitor.sh` | Run health probes, write metrics, exit 1 on breach |
| `canary_rollback.sh` | Set canary weight to 0, restore stable routing |
| `canary_promote.sh` | Step through weights, promote canary to stable |
| `canary_smoke_test.sh` | Full smoke-test suite; blocks promotion if any test fails |

## Workflows

### Deploy a canary (GitHub Actions)

1. Go to **Actions → Canary Deployment → Run workflow**
2. Select network, set `canary_weight` (default 10), action = `deploy`
3. The workflow builds, deploys, and runs an initial health check
4. If the health check fails, it auto-rolls back immediately

### Promote the canary

After observing the canary manually:

```
action = promote
```

The workflow steps through `10 → 25 → 50 → 100%`, running a health check at each step. Any failure triggers automatic rollback.

### Manual rollback

```
action = rollback
```

Or from the command line:

```bash
STELLAR_NETWORK=testnet bash scripts/canary_rollback.sh
```

### Monitor only

```
action = monitor
```

Runs health probes against the current canary and auto-rolls back if thresholds are breached.

## Local usage

```bash
# Deploy canary to testnet
STELLAR_NETWORK=testnet \
STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
DEPLOYER_SECRET=<key> \
CANARY_WEIGHT=10 \
bash scripts/canary_deploy.sh

# Check which contract to use for a request
CONTRACT_ID=$(bash scripts/canary_traffic.sh)

# Run health check
STELLAR_NETWORK=testnet \
STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
bash scripts/canary_monitor.sh

# Promote step by step
STELLAR_NETWORK=testnet \
STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
bash scripts/canary_promote.sh

# Rollback
STELLAR_NETWORK=testnet bash scripts/canary_rollback.sh
```

## Metrics

`deployment-records/canary_metrics.json` records each health check:

```json
{
  "consecutive_failures": 0,
  "last_check": "2026-04-26T17:00:00Z",
  "checks": [
    { "timestamp": "...", "pass": 3, "fail": 0, "error_rate": 0.0, "healthy": true }
  ]
}
```

## Rollback triggers

Automatic rollback fires when **either** condition is met:

- Error rate ≥ `max_error_rate` % (after `min_sample_size` checks)
- Consecutive failures ≥ `max_consecutive_failures`

## Smoke-Test Gate

`scripts/canary_smoke_test.sh` is a comprehensive automated suite that must
pass before any canary promotion step executes. It runs automatically via
`canary_promote.sh` and the `smoke-test` CI job in `canary.yml`.

### What the suite checks

| Group | Checks |
|-------|--------|
| RPC layer | Soroban RPC endpoint reachable |
| Contract existence | Canary contract found on-chain |
| Read-only contract | `get_group(0)` returns expected error, `get_total_groups` returns integer, `is_member` returns false/error |
| Write-path (testnet) | `create_group` succeeds, `get_group` reads back the created group, `get_payout_schedule` returns without error |
| Backend API | `GET /health → 200`, `GET /api/groups → 200 + valid JSON` |
| Frontend | `GET / → 200` |

Checks that cannot connect (API or frontend not deployed in the current
environment) are logged as informational warnings, not failures.

### Rollback trigger

When any critical check fails, `ROLLBACK_TRIGGER` is set internally and
`canary_rollback.sh` is invoked automatically (unless `AUTO_ROLLBACK=0`).
This ensures the stable contract resumes full traffic immediately.

### Running locally

```bash
# Minimum: contract + network
CONTRACT_ID=<canary_contract_id> \
STELLAR_NETWORK=testnet \
STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
bash scripts/canary_smoke_test.sh

# Full: with backend and frontend
CONTRACT_ID=<canary_contract_id> \
STELLAR_NETWORK=testnet \
STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
API_URL=https://api-canary.stellar-save.app \
FRONTEND_URL=https://canary.stellar-save.app \
bash scripts/canary_smoke_test.sh

# Disable automatic rollback (inspect only)
AUTO_ROLLBACK=0 CONTRACT_ID=... STELLAR_NETWORK=testnet \
STELLAR_RPC_URL=... bash scripts/canary_smoke_test.sh
```

### CI integration

The `smoke-test` job in `.github/workflows/canary.yml` runs after
`deploy-canary` for both `deploy` and `promote` actions. It reads the canary
contract ID from `deployment-records/active.json` and calls the suite with the
network-appropriate RPC and API URLs. If the suite exits non-zero, a
`auto-rollback on smoke test failure` step immediately calls
`canary_rollback.sh` before the workflow fails.
