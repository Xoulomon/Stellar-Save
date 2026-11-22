# Synthetic Monitoring

Synthetic checks run against production/staging to verify that core user flows
work end-to-end, not just that the service is up.

## Checks

The checks live in `index.js` and are consumed by the synthetic runner:

- `savings-pool:uptime` (`checkUptime`) — the savings-pool API responds to a
  health probe.
- `savings-pool:contribution-flow` (`checkContributionFlow`) — exercises a
  complete savings-pool contribution transaction against testnet/staging:
  create a contribution, submit it, and confirm the resulting balance
  reflects the contribution.

`runChecks` runs all checks and returns their results
(`{ name, ok, latencyMs, error? }`).

A read-only API health canary (`check-api-health.mjs`) is run by the
`synthetic-monitoring` GitHub workflow.

## Alert thresholds

These checks feed the following thresholds. They are documented here only; no
CI job or alerting is wired up by this repository.

| Signal | Warning | Critical |
| --- | --- | --- |
| Contribution flow success rate (5 min window) | < 99% | < 95% |
| Contribution flow end-to-end latency (p95) | > 5s | > 10s |
| Consecutive failed runs | 2 | 3 |

A failure in the contribution-flow check counts as a failed run for the
success-rate and consecutive-failure thresholds above.
