# Runbook: OnChainRepeatedReverts

**Alert:** `OnChainRepeatedReverts`
**Severity:** Warning
**Metric:** `on_chain_alerts_total{alert_type="REPEATED_REVERT"}`

## What happened

Multiple transaction invocations were reverted by the contract within the monitoring window.

Common causes:
- Front-end submitting malformed transactions (e.g. wrong sequence number)
- A script hammering the contract with invalid inputs
- A contract bug that makes a previously valid operation revert

## Immediate response

1. Inspect recent revert events for common patterns (same caller? same group?):
   ```
   GET /api/v1/events?eventType=revert&limit=20
   ```
2. If a single address is responsible for all reverts, consider rate-limiting that wallet at the API layer.
3. Check Stellar Horizon for the full transaction envelopes to inspect the operation details.

## Resolution

- Fix the client bug or rate-limit the offending wallet.
- If caused by a contract regression, roll back to the previous contract version via admin upgrade.
