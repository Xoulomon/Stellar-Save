# Synthetic Monitoring

Synthetic checks run against production/staging to verify that core user flows
work end-to-end, not just that the service is up.

## Checks

### `contribution-flow.js` — savings-pool contribution flow

Exercises the core savings-pool contribution transaction:

1. resolve the target savings pool
2. open a contribution transaction
3. submit the contribution
4. confirm the transaction is accepted and the pool balance advanced

Run manually against staging/testnet:

```sh
SYNTHETIC_BASE_URL=https://staging.example.org \
SYNTHETIC_API_KEY=... \
SYNTHETIC_POOL_ID=savings-pool-testnet \
SYNTHETIC_CONTRIBUTION_AMOUNT=1 \
node scripts/synthetic/contribution-flow.js
```

Configuration (environment variables):

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `SYNTHETIC_BASE_URL` | yes | — | Base URL of the target environment |
| `SYNTHETIC_API_KEY` | no | — | Bearer token for authenticated endpoints |
| `SYNTHETIC_POOL_ID` | no | `savings-pool-testnet` | Savings pool to contribute to |
| `SYNTHETIC_CONTRIBUTION_AMOUNT` | no | `1` | Contribution amount |
| `SYNTHETIC_TIMEOUT_MS` | no | `15000` | Per-request timeout |

The check prints a JSON result (`{ check, ok, durationMs, steps }`) and exits
non-zero on failure so the surrounding monitoring stack can record the run.

## Alert thresholds

This check feeds the following thresholds. They are documented here only; no
CI job or alerting is wired up by this repository.

| Signal | Warning | Critical |
| --- | --- | --- |
| Contribution flow success rate (5 min window) | < 99% | < 95% |
| Contribution flow end-to-end latency (p95) | > 5s | > 10s |
| Consecutive failed runs | 2 | 3 |
| `confirm-contribution` step failures | any | any |

A failure in any step (`resolve-pool`, `open-contribution`, `submit-contribution`,
`confirm-contribution`) counts as a failed run for the success-rate and
consecutive-failure thresholds above.
