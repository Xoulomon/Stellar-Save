# Runbook: OnChainMonitorStale

**Alert:** `OnChainMonitorStale`
**Severity:** Critical
**Metric:** `on_chain_monitor_last_run_timestamp_seconds`

## What happened

The `OnChainMonitor` has not updated its last-run timestamp for more than 5 minutes. On-chain anomalies may be going undetected.

## Immediate response

1. Check the backend service health:
   ```
   GET /health
   ```
2. Check recent backend logs for errors from `[OnChainMonitor]`:
   ```bash
   docker logs stellar-save-backend --tail 100 | grep OnChainMonitor
   ```
3. If the process is running but the monitor is stuck, restart the backend service.

## Resolution

- If the backend crashed: redeploy using the runbook at [service-down.md](./service-down.md).
- If the monitor loop threw an unhandled exception: check logs, fix the bug, and redeploy.
- If the database is unreachable: follow the data-loss runbook.
