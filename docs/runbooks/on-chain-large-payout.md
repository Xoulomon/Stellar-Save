# Runbook: OnChainLargePayout

**Alert:** `OnChainLargePayout`
**Severity:** Critical
**Metric:** `on_chain_large_payout_xlm`

## What happened

A single contract payout exceeded the configured large-payout threshold (default 10 000 XLM).
This could indicate:
- A legitimate large group completing its cycle
- A contract bug causing an over-payment
- An attacker exploiting the payout logic

## Immediate response (< 5 minutes)

1. **Do not ignore this alert.** Check the Stellar explorer for the tx hash logged alongside the alert.
2. Confirm the payout matches expected group parameters:
   ```
   GET /api/v1/events?eventType=payout&limit=5
   ```
3. If the payout is **not** explainable by normal group activity, proceed to step 4 immediately.
4. **Circuit breaker:** Call `pause_group` on the affected contract via the admin API or Stellar CLI:
   ```
   stellar contract invoke --id <CONTRACT_ID> -- pause_group --group_id <ID> --caller <ADMIN_KEY>
   ```
5. Notify the security team via the incident channel.

## Investigation

- Check `ContractEvent` records around the same ledger sequence for related events.
- Confirm the recipient wallet address is a legitimate member.
- Check for any `admin_action` events in the same window (could indicate key compromise).

## Resolution

- If legitimate: update the threshold in `ON_CHAIN_LARGE_PAYOUT_THRESHOLD_STROOPS` env var and unpause.
- If exploited: follow the key-compromise runbook and initiate incident response.

## Circuit breaker recommendation

Pause the affected group contract until the root cause is confirmed. This halts contributions and payouts without data loss.
