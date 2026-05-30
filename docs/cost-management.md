# Cost Management

This document describes how Stellar-Save monitors, alerts on, and optimises infrastructure costs.

## Cost components

| Component | Pricing basis | Free tier |
|-----------|--------------|-----------|
| GitHub Actions (CI) | $0.008 / Linux minute | 2,000 min/month |
| Storage (backups/exports) | ~$0.023 / GB / month | — |
| Stellar transaction fees | ~0.00001 XLM / operation | — |

## Architecture

```
GitHub Actions billing API
        │
        ▼
cost-monitoring.yml (daily cron)
        │
        ├─► cost_optimization.sh  (advisory recommendations)
        │
        └─► backend cost_metrics.ts  (Prometheus gauges)
                │
                ▼
        Prometheus ──► alerts.yml (stellar-save-costs group)
                │
                ▼
        Grafana dashboard (stellar-save-costs)
```

## Grafana dashboard

Open `http://localhost:3000/d/stellar-save-costs` after starting the monitoring stack:

```bash
docker compose -f monitoring/docker-compose.yml up -d
```

Panels:
- **Total Estimated Monthly Cost** — sum of all components
- **CI Cost** — overage beyond the 2,000-minute free tier
- **Storage Cost** — backup + export bytes at $0.023/GB
- **CI Minutes Used vs Limit** — progress bar with colour thresholds
- **CI Minutes by Workflow** — per-workflow breakdown over time
- **Stellar Transaction Fees** — daily XLM spent per network/operation
- **Storage Usage** — backup vs export bytes over time
- **Cost Breakdown Over Time** — stacked USD cost per component

## Prometheus alerts

Defined in `monitoring/prometheus/alerts.yml` under the `stellar-save-costs` group:

| Alert | Condition | Severity |
|-------|-----------|----------|
| `CiMinutesNearing90Pct` | CI minutes > 90% of limit | warning |
| `CiMinutesExceeded` | CI minutes > 100% of limit | critical |
| `MonthlyCostHigh` | Total cost > $30/month | warning |
| `MonthlyCostCritical` | Total cost > $60/month | critical |
| `StorageCostHigh` | Storage cost > $10/month | warning |
| `StellarFeeSpike` | Mainnet fees > 10 XLM/hour | warning |

## GitHub Actions workflow

`.github/workflows/cost-monitoring.yml` runs daily at 08:00 UTC and:

1. Fetches billing data via the GitHub Actions API.
2. Calculates CI overage cost.
3. Runs `scripts/cost_optimization.sh` for advisory checks.
4. Posts a weekly summary issue every Monday (labelled `cost-monitoring`).
5. Fails the run if the monthly minute limit is exceeded.

Trigger manually:

```bash
gh workflow run cost-monitoring.yml
```

## Backend metrics

`backend/src/cost_metrics.ts` exports Prometheus metrics exposed at `GET /metrics`:

```
ci_minutes_used_total{workflow}
ci_minutes_limit_total
stellar_transaction_fees_xlm_total{network,operation}
stellar_fee_usd_estimate{network}
storage_bytes_used{type}
storage_estimated_cost_usd
total_estimated_monthly_cost_usd{component}
```

Record a Stellar fee in application code:

```typescript
import { recordStellarFee, updateStorageCost, updateCiCost } from './cost_metrics';

// After a Soroban transaction
recordStellarFee(100 /* stroops */, 0.12 /* XLM/USD */, 'mainnet', 'contribute');

// After a backup/export job
updateStorageCost(backupBytes, exportBytes);
```

## Cost optimization script

Run locally at any time:

```bash
bash scripts/cost_optimization.sh
```

Checks performed:
- Artifact retention days (recommend ≤ 30)
- Duplicate Node.js / Rust toolchain setup steps (recommend reusable workflows)
- Missing `cancel-in-progress: true` concurrency settings
- Old export files beyond the 10 most recent

## Thresholds and tuning

All monetary thresholds are defined in two places and should be kept in sync:

| File | Location |
|------|----------|
| `monitoring/prometheus/alerts.yml` | `stellar-save-costs` group `expr` values |
| `monitoring/grafana/dashboards/costs.json` | `thresholds.steps[].value` in each panel |

To change the warning threshold from $30 to $40, update both files and redeploy the monitoring stack.
