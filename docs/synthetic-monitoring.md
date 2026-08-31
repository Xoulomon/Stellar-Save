# Synthetic Monitoring / Uptime Canaries

Continuously exercises critical production user journeys so an outage is caught before
users report it, via [.github/workflows/synthetic-monitoring.yml](../.github/workflows/synthetic-monitoring.yml).

## What is checked

| Journey | Check | Implementation |
|---|---|---|
| Connect wallet | Landing page loads and the "Connect your Stellar wallet" button is visible | [frontend/e2e/synthetic/canary.spec.ts](../frontend/e2e/synthetic/canary.spec.ts) |
| View groups | `/groups/browse` loads and renders the browse-groups landmark | [frontend/e2e/synthetic/canary.spec.ts](../frontend/e2e/synthetic/canary.spec.ts) |
| Read-only API health | `GET /health` and `GET /ready` on the production API return 200 | [scripts/synthetic/check-api-health.mjs](../scripts/synthetic/check-api-health.mjs) |

## Schedule and regions

The workflow runs every 15 minutes via a cron trigger, fanned out across a
`region` matrix (`us-east`, `eu-west`, `ap-southeast`). GitHub-hosted runners don't
guarantee physical placement in a given region — the matrix today groups results for
reporting/alerting. To get genuinely region-distributed checks, register self-hosted
runners labelled per region and update the matrix's `runs-on` accordingly; the workflow
structure does not need to change.

## Configuration

Set these repository secrets:

- `PRODUCTION_APP_URL` — the deployed frontend URL the Playwright canary hits.
- `PRODUCTION_API_URL` — the deployed backend's `/api/v2` base URL.
- `SLACK_WEBHOOK_URL` (optional) — if set, a failure posts a message naming the failing
  region and which journey(s) failed, with a link to the run.

## Alerting

A failing journey fails the job for that region (`fail-fast: false`, so other regions keep
reporting independently). Job failure surfaces through GitHub's own notification settings
for anyone watching the repo, and — if `SLACK_WEBHOOK_URL` is configured — through a Slack
message naming the journey and region.

## Status dashboard

Each run writes a pass/fail table per region to the GitHub Actions job summary
(`GITHUB_STEP_SUMMARY`), viewable from the workflow run page — this is the canary status
dashboard. Playwright HTML reports are also uploaded as build artifacts per region for
deeper debugging of a failure.

## Testing the alert path

Trigger the workflow manually (`workflow_dispatch`) with `simulate_failure: true`. This sets
`SIMULATE_FAILURE=1`, which makes the connect-wallet canary navigate to a non-existent route
instead of `/`, deterministically failing that check so you can confirm the job fails, the
summary reflects it, and (if configured) the Slack alert fires — without waiting for a real
outage.
