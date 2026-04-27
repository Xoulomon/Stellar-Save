# Runbook: Backup Failure

**Alerts:** `BackupFailure`, `NoRecentBackup`  
**Severity:** Warning / Critical

## Immediate Steps

1. Check backup job status via API:
   ```bash
   curl http://localhost:3001/api/v1/backup
   curl http://localhost:3001/api/v1/backup/alerts
   ```

2. Check logs for failure reason:
   ```bash
   docker logs stellar-save-backend 2>&1 | grep -i backup | grep error
   ```

3. Common causes:

   | Error | Fix |
   |-------|-----|
   | S3 credentials invalid | Rotate `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` |
   | S3 bucket not found | Verify `BACKUP_S3_BUCKET` env var |
   | Network timeout | Check VPC/firewall rules to S3 endpoint |
   | Disk full (local staging) | Free disk space; adjust retention |

4. Trigger a manual backup after fixing the root cause:
   ```bash
   curl -X POST http://localhost:3001/api/v1/backup \
     -H 'Content-Type: application/json' \
     -d '{"type":"full"}'
   ```

5. Acknowledge the alert once resolved:
   ```bash
   curl -X POST http://localhost:3001/api/v1/backup/alerts/<alertId>/acknowledge
   ```

## `NoRecentBackup` (Critical)

If no successful backup in 24h:
1. Follow steps above to restore backup functionality.
2. Verify the last known-good backup is accessible before making any data changes.
3. Escalate to the data team if the last backup is > 48h old.

## Post-Incident

- Verify backup integrity: trigger a test restore to a staging environment.
- Review backup scheduler logs for silent failures.
