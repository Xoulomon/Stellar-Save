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
| `canary_smoke_tests.sh` | Automated smoke-test suite — gates every promotion step |

## Smoke-test gate

`scripts/canary_smoke_tests.sh` is the automated quality gate that **must pass
before any promotion step proceeds**. It is invoked automatically by
`canary_promote.sh` twice per step: once before setting the new traffic weight
and once after the health-check interval. Any failure immediately triggers
`canary_rollback.sh`.

### What the smoke tests cover

| Suite | Tests |
|---|---|
| **Network & RPC reachability** | Soroban RPC endpoint responds |
| **Contract existence** | Canary contract is deployed on-chain |
| **Critical read-only calls** | `get_group`, `get_total_groups`, `list_groups`, `is_complete` |
| **Write-path calls** (testnet) | `create_group` creates a group, `get_group` reads it back |
| **Backend API health** | `GET /health`, `GET /api/groups`, `GET /api/v1/groups` |

### Running smoke tests manually

```bash
# Minimal: just contract checks
STELLAR_NETWORK=testnet \
STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
CANARY_CONTRACT_ID=<canary-contract-id> \
bash scripts/canary_smoke_tests.sh

# With backend API checks
STELLAR_NETWORK=testnet \
STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
CANARY_CONTRACT_ID=<canary-contract-id> \
BACKEND_URL=https://api-canary.stellar-save.app \
bash scripts/canary_smoke_tests.sh

# Auto-rollback on failure
STELLAR_NETWORK=testnet \
STELLAR_RPC_URL=https://soroban-testnet.stellar.org \
CANARY_CONTRACT_ID=<canary-contract-id> \
ROLLBACK_ON_FAIL=true \
bash scripts/canary_smoke_tests.sh
```

### Rollback trigger

Automatic rollback fires from the smoke-test suite when any of the following
conditions is detected:

- Contract does not exist on-chain (fatal — aborts immediately)
- A critical read-only call panics or produces an unexpected response
- `create_group` causes a fatal contract error on testnet
- Backend `/health` endpoint returns a non-2xx response (when `BACKEND_URL` is set)

A failed smoke test at **any promotion step** stops promotion and calls
`canary_rollback.sh` with `ROLLBACK_REASON=smoke_tests_failed_at_<weight>_percent`.
The canary weight is set back to 0 and all traffic returns to the stable
contract.

This is in addition to the existing `canary_monitor.sh` health-check gate (error
rate thresholds and consecutive-failure counters), which continues to run at each
step alongside the smoke tests.

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
