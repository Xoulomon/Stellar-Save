# Incident Response Plan

## Severity Levels

| Level | Definition | Response time | Example |
|-------|-----------|---------------|---------|
| P1 — Critical | Service down or funds at risk | 15 min | Contract failure, key compromise |
| P2 — High | Degraded service, data loss risk | 1 hour | High error rate, backup failure |
| P3 — Medium | Partial degradation | 4 hours | High latency, network partition |
| P4 — Low | Minor issue, no user impact | Next business day | Slow CI, cost spike |

## Roles

| Role | Responsibility |
|------|---------------|
| Incident Commander | Coordinates response, owns communication |
| Technical Lead | Diagnoses and executes recovery steps |
| Comms Lead | Updates status page and notifies users |

## Response Process

### 1. Detect & Declare

- Alert fires in Prometheus/Grafana **or** user report received.
- On-call engineer acknowledges within the response time above.
- Create an incident channel (e.g. `#incident-YYYY-MM-DD`).
- Declare severity level.

### 2. Triage

Run the health check immediately:

```bash
bash scripts/dr_recover.sh health-check
```

Identify the failure scenario and open the relevant runbook:

| Scenario | Runbook |
|----------|---------|
| Contract unresponsive / wrong results | [contract-failure.md](runbooks/contract-failure.md) |
| Data missing or corrupted | [data-loss.md](runbooks/data-loss.md) |
| Secret key leaked or compromised | [key-compromise.md](runbooks/key-compromise.md) |
| Cannot reach Stellar RPC / Horizon | [network-partition.md](runbooks/network-partition.md) |
| Backend process down | [service-down.md](runbooks/service-down.md) |
| High 5xx error rate | [high-error-rate.md](runbooks/high-error-rate.md) |
| Backup job failing | [backup-failure.md](runbooks/backup-failure.md) |

### 3. Contain

- Pause affected groups if user funds could be impacted:
  ```bash
  bash scripts/dr_recover.sh pause-all-groups
  ```
- Isolate the failing component (roll back deploy, rotate key, switch RPC endpoint).

### 4. Recover

Follow the runbook. Use `dr_recover.sh` for automated steps:

```bash
# Contract rollback
bash scripts/dr_recover.sh contract-rollback --run-id <github-run-id>

# Data restore
bash scripts/dr_recover.sh data-restore --latest

# Resume after recovery
bash scripts/dr_recover.sh unpause-all-groups
```

Verify recovery:

```bash
bash scripts/dr_recover.sh health-check
bash scripts/smoke_test_post_deploy.sh
```

### 5. Communicate

- **P1/P2:** Post status update every 30 minutes until resolved.
- **P3/P4:** Single update when resolved.
- Template:
  ```
  [STATUS UPDATE — HH:MM UTC]
  Incident: <brief description>
  Impact: <what users are experiencing>
  Status: Investigating | Identified | Recovering | Resolved
  Next update: HH:MM UTC
  ```

### 6. Resolve & Close

- Confirm all health checks pass.
- Unpause groups if they were paused.
- Close the incident channel.
- Schedule post-mortem within 48 hours for P1/P2.

## Post-Mortem Template

```
## Incident Post-Mortem — <date>

**Severity:** P?
**Duration:** HH:MM
**Impact:** <users/operations affected>

### Timeline
- HH:MM — Alert fired / issue reported
- HH:MM — Incident declared
- HH:MM — Root cause identified
- HH:MM — Recovery action taken
- HH:MM — Resolved

### Root Cause
<What went wrong and why>

### Contributing Factors
<What made it worse or harder to detect>

### Action Items
| Action | Owner | Due |
|--------|-------|-----|
| Add regression test | | |
| Update runbook | | |
| Improve alerting | | |
```

## Contact & Escalation

| Escalation path | Contact |
|----------------|---------|
| Stellar network issues | https://status.stellar.org |
| SDF support | https://discord.gg/stellardev |
| GitHub Actions issues | https://githubstatus.com |
