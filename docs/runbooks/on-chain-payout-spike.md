# Runbook: OnChainPayoutSpike

**Alert:** `OnChainPayoutSpike`
**Severity:** Warning
**Metric:** `on_chain_alerts_total{alert_type="PAYOUT_SPIKE"}`

## What happened

More than the configured threshold of payout events (default 10) occurred within the monitoring window. This could indicate:
- Multiple groups legitimately completing cycles simultaneously (expected at month/week end)
- A contract exploit repeatedly triggering `execute_payout`

## Immediate response

1. Check the payout events and confirm each maps to a valid group cycle:
   ```
   GET /api/v1/events?eventType=payout&limit=30
   ```
2. Confirm recipient addresses are registered group members.
3. If any payout cannot be matched to a valid group, escalate to the security team and consider pausing affected contracts.

## Resolution

- If legitimate (e.g. month-end cycle completions): raise the `payoutSpikeThreshold` in the monitor config for that period.
- If suspicious: pause contracts and follow the key-compromise runbook.
