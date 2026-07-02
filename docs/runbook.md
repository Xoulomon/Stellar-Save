# Stellar-Save Infrastructure Runbook

Operational procedures for the Stellar-Save platform. This runbook covers routine
infrastructure tasks, incident response, and on-call escalation.

For the full disaster-recovery workflow see [disaster-recovery.md](disaster-recovery.md).
For individual alert runbooks see [docs/runbooks/](runbooks/).

---

## Table of Contents

1. [ECS Task Scaling](#1-ecs-task-scaling)
2. [Database Restore from S3](#2-database-restore-from-s3)
3. [On-Call Escalation — Contract Pause Scenario](#3-on-call-escalation--contract-pause-scenario)
4. [Common Operational Tasks](#4-common-operational-tasks)
5. [Environment Reference](#5-environment-reference)

---

## 1. ECS Task Scaling

The backend API runs on AWS ECS Fargate. Auto-scaling is configured to track CPU
utilisation at a 70% target (scale-out cooldown 60 s, scale-in cooldown 300 s).
Use the steps below when you need to override the desired count manually.

### 1.1 Check Current Task Count

```bash
# Replace <env> with production or staging
CLUSTER="stellar-save-backend-<env>"
SERVICE="stellar-save-backend-<env>"

aws ecs describe-services \
  --cluster "$CLUSTER" \
  --services "$SERVICE" \
  --query 'services[0].{desired:desiredCount,running:runningCount,pending:pendingCount}'
```

### 1.2 Scale Up (High Load)

Use this when CPU or request latency is elevated and auto-scaling has not yet
reacted, or when you need to pre-warm capacity before a known traffic spike.

```bash
CLUSTER="stellar-save-backend-production"
SERVICE="stellar-save-backend-production"
DESIRED=6   # adjust to required count; max_capacity is set in Terraform

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --desired-count "$DESIRED"

# Confirm tasks are starting
aws ecs wait services-stable \
  --cluster "$CLUSTER" \
  --services "$SERVICE"

echo "Service stable at $DESIRED tasks"
```

**Verify health after scaling:**

```bash
# Poll the readiness probe until all tasks are healthy
for i in $(seq 1 12); do
  STATUS=$(curl -sf https://api.stellar-save.app/api/v2/ready | jq -r '.status')
  echo "$(date -u +%H:%M:%S) status=$STATUS"
  [ "$STATUS" = "ready" ] && break
  sleep 10
done
```

### 1.3 Scale Down (After Load Subsides)

```bash
CLUSTER="stellar-save-backend-production"
SERVICE="stellar-save-backend-production"
DESIRED=2   # minimum healthy count; never go below min_capacity (1)

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service "$SERVICE" \
  --desired-count "$DESIRED"
```

> **Note:** The ECS service has `deployment_minimum_healthy_percent = 50`, so
> scaling down will not drop below half the current running count in a single
> step. Terraform's `lifecycle { ignore_changes = [desired_count] }` means
> Terraform will not revert manual scaling changes on the next `apply`.

### 1.4 View Auto-Scaling Activity

```bash
aws application-autoscaling describe-scaling-activities \
  --service-namespace ecs \
  --resource-id "service/$CLUSTER/$SERVICE" \
  --max-results 10
```

### 1.5 Temporarily Disable Auto-Scaling

Use only during maintenance windows to prevent unexpected scale-in.

```bash
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id "service/$CLUSTER/$SERVICE" \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 2   # pin min == max to freeze count

# Re-enable after maintenance
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id "service/$CLUSTER/$SERVICE" \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 1 \
  --max-capacity 10
```

### 1.6 CloudWatch Metrics to Monitor During Scaling

| Metric | Namespace | Alarm threshold |
|--------|-----------|-----------------|
| CPUUtilization | AWS/ECS | > 70% for 5 min |
| MemoryUtilization | AWS/ECS | > 80% for 5 min |
| RequestCount | AWS/ApplicationELB | Spike > 2× baseline |
| TargetResponseTime | AWS/ApplicationELB | p99 > 2 s |

```bash
# Quick CPU check
aws cloudwatch get-metric-statistics \
  --namespace AWS/ECS \
  --metric-name CPUUtilization \
  --dimensions Name=ClusterName,Value="$CLUSTER" Name=ServiceName,Value="$SERVICE" \
  --start-time "$(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --period 60 \
  --statistics Average \
  --query 'sort_by(Datapoints, &Timestamp)[-5:]'
```

---

## 2. Database Restore from S3

The PostgreSQL database (RDS, `stellar-save-production`) is backed up by the
`BackupService` in the backend. Backups are stored in S3 and tracked in the
`BackupJob` table. Automated backups run on the schedule configured in
`BackupScheduler`; RDS automated snapshots are retained for 7 days with a
backup window of 03:00–04:00 UTC.

### 2.1 Identify the Restore Point

**Option A — via the API (preferred):**

```bash
# List completed backup jobs, newest first
curl -sf https://api.stellar-save.app/api/v1/backup \
  | jq '[.[] | select(.status=="completed")] | sort_by(.completedAt) | reverse | .[0:5]'
```

**Option B — via AWS Console:**

1. Open **RDS → Databases → stellar-save-production → Maintenance & backups**
2. Note the snapshot identifier or point-in-time restore window.

**Option C — list S3 objects directly:**

```bash
S3_BUCKET="${BACKUP_S3_BUCKET:-stellar-save-backups-production}"

aws s3 ls "s3://$S3_BUCKET/backups/" \
  --recursive \
  --human-readable \
  | sort | tail -20
```

### 2.2 Restore via the Backend API

This is the standard path. The `RecoveryService` downloads the backup from S3
and applies it to the database.

```bash
# Restore from the latest completed backup
curl -X POST https://api.stellar-save.app/api/v1/backup/restore \
  -H 'Content-Type: application/json' \
  -d '{}'

# Restore from a specific job
curl -X POST https://api.stellar-save.app/api/v1/backup/restore \
  -H 'Content-Type: application/json' \
  -d '{"jobId": "<job-id>"}'
```

Monitor restore progress:

```bash
JOB_ID="<job-id>"
watch -n 5 "curl -sf https://api.stellar-save.app/api/v1/backup/$JOB_ID | jq '{status,completedAt}'"
```

### 2.3 Restore via the DR Script

For full disaster-recovery scenarios use the automated script:

```bash
# Restore from latest backup
bash scripts/dr_recover.sh data-restore --latest

# Restore from a specific job
bash scripts/dr_recover.sh data-restore --job-id <job-id>
```

Required environment variables: `BACKEND_URL`, `STELLAR_NETWORK`.

### 2.4 Restore via RDS Point-in-Time (Last Resort)

Use this only when the application-level backup is unavailable or corrupted.

```bash
DB_IDENTIFIER="stellar-save-production"
RESTORE_TIME="2026-05-27T03:00:00Z"   # ISO 8601 UTC
NEW_IDENTIFIER="stellar-save-production-restored"

aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier "$DB_IDENTIFIER" \
  --target-db-instance-identifier "$NEW_IDENTIFIER" \
  --restore-time "$RESTORE_TIME" \
  --db-instance-class db.t3.small \
  --no-multi-az \
  --no-publicly-accessible

# Wait for the new instance to be available (can take 10–30 min)
aws rds wait db-instance-available \
  --db-instance-identifier "$NEW_IDENTIFIER"

echo "Restored instance available: $NEW_IDENTIFIER"
```

After the instance is available:

1. Update `DATABASE_URL` in Secrets Manager / ECS task environment to point to
   the new instance endpoint.
2. Restart ECS tasks to pick up the new connection string:
   ```bash
   aws ecs update-service \
     --cluster stellar-save-backend-production \
     --service stellar-save-backend-production \
     --force-new-deployment
   ```
3. Run smoke tests:
   ```bash
   bash scripts/smoke_test_post_deploy.sh
   ```
4. Once verified, rename or delete the old instance.

### 2.5 Verify Restore Integrity

```bash
# Check readiness probe — database dependency must be up
curl -sf https://api.stellar-save.app/api/v2/ready | jq '.dependencies.database'

# Spot-check event count (should be non-zero after restore)
curl -sf "https://api.stellar-save.app/api/v1/events/stats" | jq '.totalEvents'

# Check backup alerts for any post-restore warnings
curl -sf "https://api.stellar-save.app/api/v1/backup/alerts?unacknowledgedOnly=true"
```

---

## 3. On-Call Escalation — Contract Pause Scenario

A contract pause is a P1 incident. It means all group contributions and payouts
are halted on-chain. Follow this checklist in order.

### 3.1 Detection

A contract pause may be detected via:

- Prometheus alert `ContractPaused` firing
- User reports of failed transactions
- Monitoring dashboard showing zero `ContributionMade` events for > 15 minutes
  during expected active hours
- Automated health check failure from `scripts/smoke_test.sh`

### 3.2 Immediate Response (0–5 minutes)

```bash
# 1. Confirm the contract is paused
curl -sf https://api.stellar-save.app/api/v2/ready | jq '.'

# 2. Check recent contract events for a pause event
curl -sf "https://api.stellar-save.app/api/v1/events?eventType=GroupStatusChanged&limit=10" \
  | jq '.items[] | {timestamp, data}'

# 3. Check backend logs for errors
# In CloudWatch Logs:
#   Log group: /ecs/stellar-save-backend-production
#   Filter: { $.level = "error" }
```

### 3.3 Escalation Checklist

Work through each item in sequence. Check the box as you complete it.

- [ ] **Acknowledge the alert** in PagerDuty / OpsGenie within 5 minutes.
- [ ] **Identify the cause** — review contract events and backend error logs.
- [ ] **Notify the team** in the `#incidents` Slack channel:
  ```
  🚨 P1 INCIDENT — Contract pause detected
  Time: <UTC timestamp>
  Cause: <known / investigating>
  On-call: @<your-name>
  ```
- [ ] **Assess blast radius** — how many active groups are affected?
  ```bash
  curl -sf "https://api.stellar-save.app/api/v1/stats/groups" | jq '.activeGroups'
  ```
- [ ] **Determine if pause was intentional** — check with the deployer or admin
  key holder. If intentional (e.g., emergency security response), skip to
  step 3.5.
- [ ] **Attempt automated recovery** if cause is known and safe:
  ```bash
  bash scripts/dr_recover.sh health-check
  ```
- [ ] **Escalate to contract admin** if the pause cannot be resolved within
  15 minutes. The contract admin holds the `ADMIN_SECRET` required to unpause.
- [ ] **Escalate to engineering lead** if the contract admin is unreachable
  within 10 minutes of initial escalation.
- [ ] **Post a status update** to the public status page every 30 minutes until
  resolved.

### 3.4 Unpause the Contract

Only the contract admin (`ADMIN_SECRET`) can unpause. Ensure the root cause is
understood and resolved before unpausing.

```bash
# Verify environment variables are set
echo "Network: $STELLAR_NETWORK"
echo "Contract: $CONTRACT_ID"
echo "RPC: $STELLAR_RPC_URL"

# Unpause via the DR script
bash scripts/dr_recover.sh unpause-all-groups

# Verify groups are accepting contributions again
curl -sf "https://api.stellar-save.app/api/v1/events?eventType=GroupStatusChanged&limit=5" \
  | jq '.items[] | {timestamp, data}'
```

### 3.5 Post-Incident Actions (within 24 hours)

- [ ] Run full smoke test suite:
  ```bash
  bash scripts/smoke_test_post_deploy.sh
  ```
- [ ] Acknowledge any outstanding backup or monitoring alerts:
  ```bash
  curl -sf "https://api.stellar-save.app/api/v1/backup/alerts?unacknowledgedOnly=true" \
    | jq '.[].alertId' \
    | xargs -I{} curl -X POST "https://api.stellar-save.app/api/v1/backup/alerts/{}/acknowledge"
  ```
- [ ] Write an incident report covering:
  - Timeline of events
  - Root cause
  - Impact (groups affected, duration)
  - Remediation steps taken
  - Follow-up action items
- [ ] File follow-up issues for any gaps in monitoring or automation discovered
  during the incident.
- [ ] Update this runbook if any step was unclear or missing.

### 3.6 Escalation Contacts

| Role | Contact | Escalate after |
|------|---------|----------------|
| On-call engineer | PagerDuty rotation | Immediate |
| Contract admin | Holds `ADMIN_SECRET` | 15 min unresolved |
| Engineering lead | See team directory | 25 min unresolved |
| CTO / founder | See team directory | 45 min unresolved |

---

## 4. Common Operational Tasks

### 4.1 Deploy a New Backend Version

```bash
# Build and push Docker image
IMAGE="<ecr-registry>/stellar-save-backend:<git-sha>"
docker build -t "$IMAGE" backend/
docker push "$IMAGE"

# Update ECS task definition and force new deployment
aws ecs update-service \
  --cluster stellar-save-backend-production \
  --service stellar-save-backend-production \
  --force-new-deployment

# Monitor rollout
aws ecs wait services-stable \
  --cluster stellar-save-backend-production \
  --services stellar-save-backend-production

bash scripts/smoke_test_post_deploy.sh
```

### 4.2 Roll Back a Bad Deployment

```bash
# Find the previous task definition revision
aws ecs describe-task-definition \
  --task-definition stellar-save-backend-production \
  --query 'taskDefinition.revision'

PREV_REVISION=$(($(aws ecs describe-task-definition \
  --task-definition stellar-save-backend-production \
  --query 'taskDefinition.revision' --output text) - 1))

aws ecs update-service \
  --cluster stellar-save-backend-production \
  --service stellar-save-backend-production \
  --task-definition "stellar-save-backend-production:$PREV_REVISION"
```

Or use the rollback script:

```bash
bash scripts/rollback.sh
```

### 4.3 Rotate Database Credentials

```bash
# Generate new password
NEW_PASS=$(openssl rand -base64 32)

# Update RDS
aws rds modify-db-instance \
  --db-instance-identifier stellar-save-production \
  --master-user-password "$NEW_PASS" \
  --apply-immediately

# Update Secrets Manager
SECRET_ARN=$(aws secretsmanager list-secrets \
  --query "SecretList[?Name=='stellar-save-production/db-credentials'].ARN" \
  --output text)

aws secretsmanager put-secret-value \
  --secret-id "$SECRET_ARN" \
  --secret-string "{\"password\":\"$NEW_PASS\"}"

# Force ECS task restart to pick up new credentials
aws ecs update-service \
  --cluster stellar-save-backend-production \
  --service stellar-save-backend-production \
  --force-new-deployment
```

### 4.4 Trigger a Manual Backup

```bash
# Full backup
curl -X POST https://api.stellar-save.app/api/v1/backup \
  -H 'Content-Type: application/json' \
  -d '{"type":"full"}'

# Incremental backup
curl -X POST https://api.stellar-save.app/api/v1/backup \
  -H 'Content-Type: application/json' \
  -d '{"type":"incremental"}'
```

### 4.5 Check Service Health

```bash
# Liveness
curl -sf https://api.stellar-save.app/api/v2/health | jq '.'

# Readiness (checks DB + Horizon)
curl -sf https://api.stellar-save.app/api/v2/ready | jq '.'

# Prometheus metrics
curl -sf https://api.stellar-save.app/metrics | grep -E '^(http_|process_)'
```

### 4.6 View Application Logs

```bash
# Stream live logs from ECS (requires awslogs or CloudWatch Logs Insights)
aws logs tail /ecs/stellar-save-backend-production --follow

# Search for errors in the last hour
aws logs filter-log-events \
  --log-group-name /ecs/stellar-save-backend-production \
  --start-time $(($(date +%s) - 3600))000 \
  --filter-pattern '{ $.level = "error" }' \
  --query 'events[*].message' \
  --output text
```

---

## 5. Environment Reference

### 5.1 Key Environment Variables

| Variable | Description | Where set |
|----------|-------------|-----------|
| `PORT` | Backend HTTP port (default 3001) | ECS task definition |
| `DATABASE_URL` | PostgreSQL connection string | Secrets Manager |
| `STELLAR_NETWORK` | `testnet` or `mainnet` | ECS task definition |
| `STELLAR_RPC_URL` | Soroban RPC endpoint | ECS task definition |
| `HORIZON_URL` | Stellar Horizon endpoint | ECS task definition |
| `CONTRACT_ID` | Deployed contract address | ECS task definition |
| `ADMIN_SECRET` | Contract admin keypair secret | Secrets Manager |
| `BACKUP_ENABLED` | Enable backup scheduler (`true`/`false`) | ECS task definition |
| `BACKUP_S3_BUCKET` | S3 bucket for backups | ECS task definition |
| `INDEXER_ENABLED` | Enable contract event indexer | ECS task definition |
| `SENDGRID_API_KEY` | SendGrid API key for email | Secrets Manager |
| `FRONTEND_URL` | Frontend base URL for links | ECS task definition |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | ECS task definition |

### 5.2 Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v2/health` | Liveness probe |
| `GET /api/v2/ready` | Readiness probe (checks DB + Horizon) |
| `GET /metrics` | Prometheus metrics |
| `GET /api/v1/events/stats` | Contract event index health |
| `GET /api/v1/backup/alerts` | Backup alert status |

### 5.3 Infrastructure Resources

| Resource | Identifier |
|----------|-----------|
| ECS Cluster | `stellar-save-backend-production` |
| ECS Service | `stellar-save-backend-production` |
| RDS Instance | `stellar-save-production` |
| CloudWatch Log Group | `/ecs/stellar-save-backend-production` |
| S3 Backup Bucket | `stellar-save-backups-production` |
| Secrets Manager | `stellar-save-production/db-credentials` |

### 5.4 Related Documentation

- [Architecture Overview](architecture.md)
- [Disaster Recovery](disaster-recovery.md)
- [Deployment Guide](deployment.md)
- [Threat Model & Security](threat-model.md)
- [Individual Alert Runbooks](runbooks/)
- [API Reference](api-reference.md)
