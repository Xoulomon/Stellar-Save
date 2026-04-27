# Disaster Recovery

This document is the master reference for Stellar-Save disaster recovery. It covers failure scenarios, recovery procedures, tooling, and testing.

## RTO / RPO Targets

| Target | Value |
|--------|-------|
| Recovery Time Objective (RTO) | < 2 hours |
| Recovery Point Objective (RPO) | < 24 hours |

## Critical Failure Scenarios

| Scenario | Severity | Runbook |
|----------|----------|---------|
| Smart contract failure / panic | P1 | [contract-failure.md](runbooks/contract-failure.md) |
| Data loss or corruption | P1 | [data-loss.md](runbooks/data-loss.md) |
| Secret key compromise | P1 | [key-compromise.md](runbooks/key-compromise.md) |
| Stellar RPC / network partition | P2 | [network-partition.md](runbooks/network-partition.md) |
| Backend service down | P1 | [service-down.md](runbooks/service-down.md) |
| High error rate | P2 | [high-error-rate.md](runbooks/high-error-rate.md) |
| Backup failure | P2 | [backup-failure.md](runbooks/backup-failure.md) |

## Automated Recovery Script

`scripts/dr_recover.sh` is the single entry point for automated recovery actions.

```bash
# Check all systems
bash scripts/dr_recover.sh health-check

# Halt all group activity (contain an incident)
bash scripts/dr_recover.sh pause-all-groups

# Roll back contract to a previous GitHub Actions run
bash scripts/dr_recover.sh contract-rollback --run-id <run-id>

# Restore data from latest backup
bash scripts/dr_recover.sh data-restore --latest

# Restore data from a specific backup
bash scripts/dr_recover.sh data-restore --job-id <job-id>

# Resume after recovery
bash scripts/dr_recover.sh unpause-all-groups
```

Required environment variables:

| Variable | Used by |
|----------|---------|
| `STELLAR_NETWORK` | All contract commands |
| `STELLAR_RPC_URL` | All contract commands |
| `CONTRACT_ID` | pause/unpause, health-check |
| `ADMIN_SECRET` | pause/unpause |
| `BACKEND_URL` | data-restore, health-check |
| `GH_TOKEN` | contract-rollback |
| `DEPLOYER_SECRET` | contract-rollback |

## Recovery Workflow

```
Incident detected
      │
      ▼
bash scripts/dr_recover.sh health-check
      │
      ├─ Contract issue? ──► contract-failure runbook ──► contract-rollback
      ├─ Data issue?     ──► data-loss runbook        ──► data-restore
      ├─ Key issue?      ──► key-compromise runbook   ──► rotate keys
      └─ Network issue?  ──► network-partition runbook ──► switch RPC
      │
      ▼
bash scripts/dr_recover.sh unpause-all-groups
bash scripts/smoke_test_post_deploy.sh
      │
      ▼
Incident resolved → post-mortem
```

## CI Testing

`.github/workflows/disaster-recovery.yml` runs weekly (Sunday 02:00 UTC) and:

- Validates `dr_recover.sh` executes without errors
- Runs contract pause/unpause tests
- Confirms all runbooks exist and are non-empty
- Checks script syntax with `bash -n`

Trigger manually:

```bash
gh workflow run disaster-recovery.yml
```

## Backup & Restore

Backups are managed by `BackupService` and `RecoveryService` in the backend.

List restore points:
```bash
curl http://localhost:3001/api/v1/backup | jq '[.[] | select(.status=="completed")]'
```

Restore via API:
```bash
# Latest full backup
curl -X POST http://localhost:3001/api/v1/recovery/restore-latest \
  -H 'Content-Type: application/json' -d '{"type":"full"}'

# Specific job
curl -X POST http://localhost:3001/api/v1/recovery/restore \
  -H 'Content-Type: application/json' -d '{"jobId":"<id>"}'
```

## Contract Rollback

Rollbacks use `scripts/rollback.sh`, which downloads a previous WASM artifact from GitHub Actions and redeploys it.

Find the last known-good run ID:
```bash
gh run list --workflow=ci.yml --status=success --limit=10
```

Then roll back:
```bash
bash scripts/dr_recover.sh contract-rollback --run-id <run-id>
```

## Related Documents

- [Incident Response Plan](incident-response-plan.md) — severity levels, roles, comms templates
- [Threat Model & Security](threat-model.md) — attack surface and mitigations
- [Deployment Guide](deployment.md) — deploy and rollback procedures
- [Cost Management](cost-management.md) — cost monitoring and alerts
