# Runbook: OnChainErrorSpike

**Alerts:** `OnChainErrorSpikeCritical`, `OnChainErrorSpikeWarning`
**Severity:** Warning / Critical
**Metric:** `on_chain_alerts_total{alert_type="ERROR_SPIKE"}`

## What happened

Contract error events exceeded the threshold within the monitoring window (default 5 minutes).

- **Warning:** ≥ 5 errors in 5 min — investigate, no immediate action required.
- **Critical:** ≥ 15 errors in 5 min — circuit breaker recommended.

## Immediate response

1. Check recent error events:
   ```
   GET /api/v1/events?eventType=error&limit=20
   ```
2. Identify the contract and group affected from the event data.
3. For **critical**: disable new group creation/contributions via feature flag or API:
   ```bash
   curl -X POST /api/admin/circuit-breaker \
     -H "x-admin-secret: $ADMIN_SECRET" \
     -d '{"action":"disable","scope":"contributions"}'
   ```

## Investigation

- Are errors concentrated on a single group or spread across many?
- Did a recent deployment precede the spike? Check the deployment log.
- Are the errors a known Soroban error code (e.g. `ContractError(1)` = insufficient balance)?

## Resolution

- Identify and fix the root cause (contract bug, malformed input, RPC issue).
- Re-enable contributions once the root cause is resolved.
- If it was a transient RPC outage, the alert should self-resolve.

## Circuit breaker recommendation

For critical severity: halt contribution transactions at the API gateway level until root cause is confirmed.
