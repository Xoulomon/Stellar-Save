# Runbook: OnChainAdminAction

**Alert:** `OnChainAdminAction`
**Severity:** Warning
**Metric:** `on_chain_alerts_total{alert_type="ADMIN_ACTION"}`

## What happened

A `pause_group`, `unpause_group`, or other admin-privileged contract call was detected on-chain.

## Immediate response

1. **Verify the action was intentional.** Check with the team member who has admin key access.
2. Check the event details — tx hash and caller address — against your known admin keys:
   ```
   GET /api/v1/events?eventType=admin_action&limit=5
   ```
3. If the admin key is **unknown or unexpected**, treat this as a key compromise. Follow the [key-compromise runbook](./key-compromise.md) immediately.

## Resolution

- If intentional: acknowledge the alert and document the reason in the incident log.
- If unexpected: revoke admin key, rotate credentials, and initiate incident response.
