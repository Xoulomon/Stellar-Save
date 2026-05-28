# Load Testing

Stellar-Save uses [k6](https://k6.io) to verify system performance under high traffic.

## Test scenarios

| File | Target | What it tests |
|---|---|---|
| `tests/load/api.test.js` | Backend API (`:3000`) | Recommendations, search, preferences, export |
| `tests/load/frontend.test.js` | Frontend (`:4173`) | Page loads, static asset delivery |
| `tests/load/contract.test.js` | Backend API (`:3000`) | Many-groups simulation (contribution events, payout exports) |

## Running locally

### Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

### Run a test

```bash
# Smoke test (1 VU, 30 s) — default in CI
k6 run tests/load/api.test.js

# Load test (ramp to 50 VUs)
k6 run --env SCENARIO=load tests/load/api.test.js

# Stress test (ramp to 200 VUs)
k6 run --env SCENARIO=stress tests/load/contract.test.js

# Against a remote environment
k6 run --env BASE_URL=https://staging.example.com tests/load/api.test.js
```

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `http://localhost:3000` | Backend API base URL |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend base URL |
| `SCENARIO` | `load` | `smoke`, `load`, `stress`, or `spike` |
| `GROUP_COUNT` | `200` | Number of simulated groups in contract test |

## Performance baselines

These are the **target thresholds** enforced by k6. Tests fail if any threshold is breached.

### API endpoints

| Metric | Threshold | Notes |
|---|---|---|
| `http_req_duration` p95 | < 500 ms | All endpoints |
| `http_req_duration` p99 | < 1 000 ms | Load scenario |
| `http_req_failed` | < 1% | All scenarios |
| `recommendation_duration` p95 | < 500 ms | Custom metric |
| `search_duration` p95 | < 500 ms | Custom metric |

### Frontend pages

| Metric | Threshold | Notes |
|---|---|---|
| `page_load_duration` p95 | < 3 000 ms | Full page load |
| `asset_load_duration` p95 | < 1 000 ms | Static assets |
| `http_req_failed` | < 1% | |

### Stress / spike scenarios

| Metric | Threshold |
|---|---|
| `http_req_failed` | < 5% (stress), < 10% (spike) |
| `http_req_duration` p95 | < 2 000 ms (stress) |

## CI integration

The workflow (`.github/workflows/load-testing.yml`) runs automatically on every PR:

- **PRs / push to main**: smoke scenario (1 VU, 30 s) — fast sanity check
- **Manual dispatch**: choose `smoke`, `load`, or `stress` via the GitHub Actions UI

k6 JSON summaries are uploaded as workflow artifacts (`k6-results-*`) and retained for 7 days.

## Adding new tests

1. Create `tests/load/my-feature.test.js`
2. Import shared options from `./config.js`
3. Implement `export default function()` with your scenario
4. Add `my-feature` to the `matrix.test` list in `.github/workflows/load-testing.yml`
