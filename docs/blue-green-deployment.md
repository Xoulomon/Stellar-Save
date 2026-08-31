# Blue-Green Frontend Deployment

Zero-downtime deployments for the Stellar-Save frontend using a blue-green strategy.

## How it works

Two identical deployment slots — **blue** and **green** — exist at all times. Only one slot receives live traffic. When deploying:

1. Build the frontend and deploy to the **inactive** slot
2. Run health checks against the inactive slot
3. Switch the router to point live traffic at the new slot (instant, atomic)
4. The old slot stays warm as an instant rollback target

```
         ┌─────────────┐
         │   Router    │
         └──────┬──────┘
                │ live traffic
        ┌───────▼───────┐
        │  Active slot  │  ← e.g. green (new build)
        └───────────────┘
        ┌───────────────┐
        │ Standby slot  │  ← e.g. blue  (previous build, ready for rollback)
        └───────────────┘
```

## Workflow triggers

The workflow (`.github/workflows/blue-green-frontend.yml`) runs:

- **Automatically** on push to `main` when `frontend/` files change
- **Manually** via `workflow_dispatch` with three actions:
  - `deploy` — build, deploy to inactive slot, health check, switch
  - `switch` — switch traffic between slots without redeploying
  - `rollback` — instantly revert to the previous slot

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/bg_deploy.sh` | Upload build to the inactive slot |
| `scripts/bg_health_check.sh` | HTTP health checks against a slot |
| `scripts/bg_switch.sh` | Atomically switch live traffic to a slot |
| `scripts/bg_rollback.sh` | Revert to the previous slot |

## Registry

`deployment-records/frontend-active.json` tracks the current state:

```json
{
  "live_slot": "green",
  "previous_slot": "blue",
  "build_hash": "abc123def456",
  "commit": "a1b2c3d4...",
  "deployed_at": "2026-04-26T22:00:00Z",
  "deployed_by": "github-actions",
  "environment": "production",
  "blue_build_hash": "...",
  "blue_deployed_at": "...",
  "green_build_hash": "...",
  "green_deployed_at": "..."
}
```

## Required secrets and variables

Configure these in your GitHub repository / environment settings:

| Name | Type | Description |
|------|------|-------------|
| `DEPLOY_TOKEN` | Secret | Auth token for your hosting provider API |
| `DEPLOY_HOST` | Variable | Base URL of your deployment host |
| `VITE_STELLAR_NETWORK` | Variable | `testnet` or `mainnet` |
| `VITE_STELLAR_RPC_URL` | Variable | Stellar RPC endpoint |

## Adapting to your hosting provider

The scripts contain clearly marked sections to replace with your provider's commands:

**AWS S3 + CloudFront:**
```bash
aws s3 sync dist/ "s3://my-bucket/${DEPLOY_ENV}-${TARGET_SLOT}/" --delete
aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"
```

**Netlify:**
```bash
netlify deploy --dir=dist --alias="${DEPLOY_ENV}-${TARGET_SLOT}"
# Switch: update the production alias
netlify alias set production "${TARGET_SLOT}"
```

**rsync / VPS:**
```bash
rsync -az --delete dist/ "user@host:/var/www/${DEPLOY_ENV}/${TARGET_SLOT}/"
# Switch: update nginx symlink
ssh user@host "ln -sfn /var/www/${DEPLOY_ENV}/${TARGET_SLOT} /var/www/live && nginx -s reload"
```

## Rollback

**Automatic:** If the post-switch health check fails, the workflow calls `bg_rollback.sh` automatically.

**Manual:** Trigger the workflow with `action: rollback`. The previous slot is always warm — rollback takes seconds.

```bash
# Local rollback (emergency)
DEPLOY_ENV=production DEPLOY_HOST=https://example.com DEPLOY_TOKEN=xxx \
  bash scripts/bg_rollback.sh
```

## Health checks

`bg_health_check.sh` verifies:
1. Root page returns HTTP 200
2. `index.html` contains asset references
3. No 5xx responses
4. Response time < 5 seconds

Checks retry up to 5 times with 10-second delays. Tune with:
- `HEALTH_RETRIES` (default: 5)
- `HEALTH_RETRY_DELAY` (default: 10s)
- `HEALTH_TIMEOUT` (default: 10s per request)
