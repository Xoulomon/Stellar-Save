# Runbook: Data Loss

**Scenario:** Backend data (group state, contribution records, export history) is missing or corrupted.  
**Severity:** Critical  
**Impact:** Users cannot view history; payout rotation may be incorrect.

## Detection

- API returns empty results for known groups
- Checksum mismatch errors in backup logs
- `NoRecentBackup` alert firing

## Immediate Steps

### 1. Stop writes immediately

```bash
# Pause all active groups to prevent further state changes
bash scripts/dr_recover.sh pause-all-groups
```

### 2. Assess scope

```bash
# List available restore points
curl http://localhost:3001/api/v1/backup | jq '[.[] | select(.status=="completed") | {id, createdAt, type, recordCount}]'
```

### 3. Restore from backup

**Latest full backup:**
```bash
curl -X POST http://localhost:3001/api/v1/recovery/restore-latest \
  -H 'Content-Type: application/json' \
  -d '{"type":"full"}'
```

**Specific restore point:**
```bash
curl -X POST http://localhost:3001/api/v1/recovery/restore \
  -H 'Content-Type: application/json' \
  -d '{"jobId":"<backup-job-id>"}'
```

**Via automated script:**
```bash
bash scripts/dr_recover.sh data-restore --job-id <backup-job-id>
# or restore latest:
bash scripts/dr_recover.sh data-restore --latest
```

### 4. Verify restore integrity

```bash
# Check record counts match pre-incident snapshot
curl http://localhost:3001/api/v1/backup/<job-id> | jq '{recordCount, checksum}'
```

### 5. Resume operations

```bash
bash scripts/dr_recover.sh unpause-all-groups
```

## RTO / RPO Targets

| Target | Value |
|--------|-------|
| Recovery Time Objective (RTO) | < 2 hours |
| Recovery Point Objective (RPO) | < 24 hours (daily backup cadence) |

## Escalation

- No valid backup found → escalate to data team; do not attempt manual reconstruction.
- On-chain state diverges from restored off-chain state → halt and escalate.

## Post-Incident

- Increase backup frequency if RPO was breached.
- Verify backup scheduler is running: `curl http://localhost:3001/api/v1/backup/alerts`.
- File incident report within 24 hours (see `docs/incident-response-plan.md`).
