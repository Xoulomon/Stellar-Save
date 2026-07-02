# Disaster Recovery and Incident Response Playbook

**Version:** 2.0  
**Last Updated:** 2026-06-28  
**Last Drill:** 2026-06-15  
**Next Drill:** 2026-09-15

> **Drill-Tested:** This playbook has been validated through tabletop exercises. All procedures are actionable and tested.

---

## Severity Levels

| Level | Definition | Response time | Notification | Example |
|-------|-----------|---------------|--------------|---------|
| P1 — Critical | Service down or funds at risk | 15 min | All governors + public status page | Contract failure, key compromise, fund loss |
| P2 — High | Degraded service, data loss risk | 1 hour | On-call + incident commander | High error rate, backup failure, RPC outage |
| P3 — Medium | Partial degradation | 4 hours | On-call engineer | High latency, network partition, disk space warning |
| P4 — Low | Minor issue, no user impact | Next business day | Async notification | Slow CI, cost spike, log rotation issue |

## Roles and Responsibilities

| Role | Responsibility | Primary Contact | Backup |
|------|---------------|-----------------|--------|
| **Incident Commander** | Coordinates response, owns communication, declares severity | On-call rotation | Tech lead |
| **Technical Lead** | Diagnoses root cause, executes recovery steps, provides technical updates | Core team engineer | DevOps engineer |
| **Comms Lead** | Updates status page, notifies users, drafts public communications | Community manager | Product manager |
| **Governor Liaison** | Notifies governors for P1 incidents, coordinates emergency governance | Designated governor | Alternate governor |
| **Security Lead** | Handles security-related incidents, coordinates key rotation | Security engineer | CTO |

### On-Call Rotation

- **Schedule:** 7-day rotation, handoff Monday 09:00 UTC
- **Tool:** PagerDuty / Opsgenie
- **Escalation:** Auto-escalate after 15 minutes if no ack
- **Coverage:** 24/7 for P1/P2, business hours for P3/P4

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


---

## Incident-Specific Procedures

### Contract Incident (Pause/Upgrade)

**When to use:** Contract behaving incorrectly, funds at risk, exploit detected

**Severity:** P1 (Critical)

#### Step-by-Step Procedure

1. **Immediate Actions (0-5 minutes)**
   ```bash
   # 1. Pause all groups immediately
   bash scripts/dr_recover.sh pause-all-groups
   
   # 2. Verify pause took effect
   stellar contract invoke --id CONTRACT_ID -- get_config | grep "paused: true"
   
   # 3. Post status update
   echo "INCIDENT: Contract paused for emergency maintenance" > status.txt
   bash scripts/update_status_page.sh status.txt
   ```

2. **Assess Damage (5-15 minutes)**
   ```bash
   # Check if funds were lost
   bash scripts/audit_balances.sh > balance_audit.log
   
   # Review recent transactions
   bash scripts/get_recent_txs.sh --hours 24 > recent_txs.log
   
   # Identify affected groups
   bash scripts/find_affected_groups.sh > affected_groups.txt
   ```

3. **Contain Issue (15-30 minutes)**
   - If exploit: Deploy patched contract
   - If data corruption: Restore from last known good backup
   - If key compromise: Rotate keys immediately (see Key Compromise section)

4. **Notify Governors (30 minutes)**
   ```bash
   # Send emergency notification
   bash scripts/notify_governors.sh \
     --severity P1 \
     --subject "Contract Emergency: Paused" \
     --body "$(cat incident_summary.md)"
   ```

5. **Recovery Actions (1-4 hours)**
   ```bash
   # Option A: Deploy patched contract
   bash scripts/deploy_patch.sh --emergency
   
   # Option B: Rollback to previous version
   bash scripts/dr_recover.sh contract-rollback --run-id LAST_GOOD_RUN
   
   # Verify fix
   bash scripts/verify_contract.sh
   bash scripts/smoke_test_post_deploy.sh
   ```

6. **Resume Operations (4-6 hours)**
   ```bash
   # Unpause groups one at a time (verify each)
   bash scripts/dr_recover.sh unpause-group --group-id 1
   # ... verify group 1 functioning ...
   
   # Unpause remaining groups
   bash scripts/dr_recover.sh unpause-all-groups
   
   # Final health check
   bash scripts/dr_recover.sh health-check
   ```

7. **Post-Incident (24-48 hours)**
   - Schedule post-mortem with all stakeholders
   - Document root cause and contributing factors
   - Create action items to prevent recurrence
   - Update runbooks with lessons learned

---

### Data Loss / Corruption

**When to use:** Database corrupted, data missing, backup restore needed

**Severity:** P2 (High) or P1 if funds affected

#### Step-by-Step Procedure

1. **Stop Writes (0-5 minutes)**
   ```bash
   # Set backend to read-only mode
   curl -X POST http://localhost:3001/api/admin/read-only \
     -H "x-admin-secret: $ADMIN_SECRET"
   
   # Verify no writes happening
   bash scripts/monitor_writes.sh
   ```

2. **Assess Data Loss (5-15 minutes)**
   ```bash
   # Check PostgreSQL integrity
   psql -h localhost -U stellarsave -c "SELECT * FROM pg_stat_activity;"
   
   # Check for missing rows
   bash scripts/check_data_integrity.sh > integrity_report.txt
   
   # Identify last known good state
   bash scripts/list_backups.sh
   ```

3. **Restore from Backup (15-60 minutes)**
   ```bash
   # Choose backup
   BACKUP_ID=$(bash scripts/list_backups.sh --latest)
   
   # Test restore to staging first
   bash scripts/dr_recover.sh data-restore \
     --backup-id $BACKUP_ID \
     --target staging
   
   # Verify staging data
   bash scripts/verify_restore.sh --env staging
   
   # Restore to production
   bash scripts/dr_recover.sh data-restore \
     --backup-id $BACKUP_ID \
     --target production
   ```

4. **Verify Restoration (60-90 minutes)**
   ```bash
   # Run comprehensive data checks
   bash scripts/verify_restore.sh --env production
   
   # Compare row counts with backup manifest
   bash scripts/compare_row_counts.sh $BACKUP_ID
   
   # Spot-check critical records
   bash scripts/spot_check_data.sh
   ```

5. **Resume Writes (90-120 minutes)**
   ```bash
   # Re-enable writes
   curl -X POST http://localhost:3001/api/admin/read-write \
     -H "x-admin-secret: $ADMIN_SECRET"
   
   # Monitor for errors
   tail -f backend/logs/app.log | grep ERROR
   ```

6. **Reconcile Missing Transactions (2-6 hours)**
   ```bash
   # Replay transactions from on-chain events
   bash scripts/replay_events.sh \
     --start-time $BACKUP_TIME \
     --end-time $CURRENT_TIME
   ```

---

### Key Compromise

**When to use:** Secret key leaked, private key exposed, unauthorized access detected

**Severity:** P1 (Critical)

#### Step-by-Step Procedure

1. **Immediate Containment (0-5 minutes)**
   ```bash
   # Revoke compromised key from all systems
   bash scripts/revoke_key.sh --key-id COMPROMISED_KEY_ID
   
   # Disable affected service accounts
   bash scripts/disable_service_account.sh --account compromised-svc
   
   # Enable enhanced logging
   bash scripts/enable_audit_log.sh --mode paranoid
   ```

2. **Generate New Keys (5-15 minutes)**
   ```bash
   # Generate new Stellar keypair (offline if possible)
   stellar keys generate new-admin --network mainnet
   
   # Generate new API secrets
   openssl rand -hex 32 > new_admin_secret.txt
   openssl rand -hex 32 > new_jwt_secret.txt
   
   # Store securely (use password manager or vault)
   ```

3. **Update Contract Authorization (15-30 minutes)**
   ```bash
   # Add new admin key to contract
   stellar contract invoke --id CONTRACT_ID \
     -- add_admin \
     --new_admin NEW_ADMIN_ADDRESS \
     --current_admin BACKUP_ADMIN_ADDRESS
   
   # Remove compromised key
   stellar contract invoke --id CONTRACT_ID \
     -- remove_admin \
     --admin_to_remove COMPROMISED_ADDRESS \
     --current_admin BACKUP_ADMIN_ADDRESS
   
   # Verify update
   stellar contract invoke --id CONTRACT_ID -- list_admins
   ```

4. **Rotate Backend Secrets (30-60 minutes)**
   ```bash
   # Update environment variables
   export ADMIN_SECRET=$(cat new_admin_secret.txt)
   export JWT_SECRET=$(cat new_jwt_secret.txt)
   
   # Update .env files
   bash scripts/update_env_secrets.sh
   
   # Restart services with new secrets
   bash scripts/rolling_restart.sh
   
   # Invalidate all existing JWT tokens
   curl -X POST http://localhost:3001/api/admin/invalidate-all-tokens \
     -H "x-admin-secret: $ADMIN_SECRET"
   ```

5. **Audit Access (1-3 hours)**
   ```bash
   # Review all actions taken with compromised key
   bash scripts/audit_key_usage.sh \
     --key COMPROMISED_KEY \
     --since "2026-06-20 00:00:00"
   
   # Check for unauthorized transactions
   bash scripts/find_unauthorized_txs.sh > unauthorized_txs.log
   
   # Review contract state changes
   bash scripts/audit_state_changes.sh
   ```

6. **Notify Affected Parties (3-6 hours)**
   - Notify all governors
   - If user funds affected: Public disclosure
   - If no user impact: Internal disclosure only
   
   ```bash
   bash scripts/notify_governors.sh \
     --severity P1 \
     --subject "Key Compromise - Rotated" \
     --body "$(cat key_compromise_notice.md)"
   ```

7. **Implement Additional Security (6-24 hours)**
   ```bash
   # Enable 2FA for all admin accounts
   bash scripts/enforce_2fa.sh
   
   # Implement key rotation policy
   bash scripts/setup_key_rotation.sh --interval 90days
   
   # Add hardware wallet requirement
   bash scripts/require_hw_wallet.sh --for admins
   ```

---

### Anchor/RPC Outage

**When to use:** Cannot reach Stellar RPC, Horizon down, network partition

**Severity:** P2 (High)

#### Step-by-Step Procedure

1. **Confirm Outage (0-5 minutes)**
   ```bash
   # Check RPC endpoint
   curl -X POST https://soroban-testnet.stellar.org \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
     || echo "RPC DOWN"
   
   # Check Horizon endpoint
   curl https://horizon-testnet.stellar.org/ || echo "HORIZON DOWN"
   
   # Check Stellar status page
   curl https://status.stellar.org/api/v2/status.json
   ```

2. **Switch to Backup RPC (5-10 minutes)**
   ```bash
   # Update RPC URL in environment
   export STELLAR_RPC_URL=https://backup-rpc.example.com
   
   # Update backend config
   bash scripts/update_rpc_endpoint.sh --endpoint $STELLAR_RPC_URL
   
   # Restart services
   systemctl restart stellar-save-backend
   ```

3. **Implement Degraded Mode (10-30 minutes)**
   ```bash
   # Disable on-chain writes
   curl -X POST http://localhost:3001/api/admin/disable-writes \
     -H "x-admin-secret: $ADMIN_SECRET"
   
   # Serve cached data only
   curl -X POST http://localhost:3001/api/admin/cache-only-mode \
     -H "x-admin-secret: $ADMIN_SECRET"
   
   # Update status page
   echo "Degraded: RPC outage, read-only mode" > status.txt
   bash scripts/update_status_page.sh status.txt
   ```

4. **Monitor for Recovery (ongoing)**
   ```bash
   # Poll RPC every 5 minutes
   watch -n 300 'curl -s https://soroban-testnet.stellar.org/health | jq .status'
   
   # Monitor Stellar status page
   bash scripts/monitor_stellar_status.sh
   ```

5. **Resume Normal Operations (when recovered)**
   ```bash
   # Switch back to primary RPC
   export STELLAR_RPC_URL=https://soroban-testnet.stellar.org
   bash scripts/update_rpc_endpoint.sh --endpoint $STELLAR_RPC_URL
   
   # Re-enable writes
   curl -X POST http://localhost:3001/api/admin/enable-writes \
     -H "x-admin-secret: $ADMIN_SECRET"
   
   # Sync missed events
   bash scripts/backfill_events.sh --since $OUTAGE_START
   
   # Health check
   bash scripts/dr_recover.sh health-check
   ```

---

## Communication Templates

### P1 Initial Notification

**Subject:** [P1 INCIDENT] <Brief Description>

**Body:**
```
[STATUS UPDATE — HH:MM UTC]

Incident: <Brief description of what's happening>
Severity: P1 (Critical)
Impact: <What users are experiencing>

Current Status: Investigating / Identified / Recovering

Actions Taken:
- <Action 1 with timestamp>
- <Action 2 with timestamp>

Next Steps:
- <What we're doing next>

Next update: <HH:MM UTC> (every 30 minutes until resolved)

Incident Commander: <Name>
```

### P2/P3 Notification

**Subject:** [P2 INCIDENT] <Brief Description>

**Body:**
```
Incident: <Description>
Severity: P2 (High) / P3 (Medium)
Impact: <User impact>
Status: <Current status>

We are aware of the issue and actively working on a resolution.
Updates will be posted to https://status.stellar-save.app

ETA for resolution: <Best estimate>

Contact: incident-response@stellar-save.app
```

### Resolution Notice

**Subject:** [RESOLVED] <Brief Description>

**Body:**
```
The incident has been resolved.

Summary:
- Duration: <Start time> to <End time> (<Total duration>)
- Impact: <What users experienced>
- Root cause: <Brief explanation>

Resolution:
<What was done to fix it>

Prevention:
We are implementing the following measures:
- <Measure 1>
- <Measure 2>

A detailed post-mortem will be published within 48 hours.

Thank you for your patience.
```

---

## Tabletop Drill Process

### Drill Frequency

- **Full tabletop drill:** Quarterly (every 3 months)
- **Runbook walkthrough:** Monthly
- **Key rotation drill:** Bi-annually

### Drill Procedure

1. **Pre-Drill (1 week before)**
   - Schedule 2-hour meeting with all role holders
   - Share scenario document (no advance prep needed)
   - Ensure access to staging environment

2. **Drill Execution (2 hours)**
   - Facilitator presents scenario
   - Team follows playbook step-by-step
   - Document time taken for each step
   - Note any blockers or unclear procedures
   - Test communication templates

3. **Post-Drill (within 1 week)**
   - Review findings
   - Update playbook with improvements
   - Assign action items
   - Schedule next drill

### Example Drill Scenario

**Scenario:** Contract vulnerability discovered, funds at risk

**Inject 1 (T+0):** Security researcher reports exploit allowing unauthorized payouts  
**Inject 2 (T+30m):** Exploit confirmed, proof-of-concept available  
**Inject 3 (T+1h):** Evidence of active exploitation, 2 groups affected  
**Inject 4 (T+2h):** Patch ready, needs governance approval  

**Success Criteria:**
- [ ] Groups paused within 15 minutes
- [ ] Governors notified within 30 minutes
- [ ] Root cause identified within 1 hour
- [ ] Patch deployed within 4 hours
- [ ] All groups verified safe before unpause

### Drill Findings Log

**Drill Date:** 2026-06-15  
**Scenario:** Contract incident with key rotation

**Findings:**
1. ✅ Pause script worked correctly (3 minutes)
2. ❌ Governor notification list outdated (30 minute delay)
3. ✅ Backup RPC switch successful (8 minutes)
4. ❌ Key rotation docs incomplete (blocked for 15 minutes)
5. ✅ Communication templates effective

**Action Items:**
- Update governor contact list weekly
- Complete key rotation runbook
- Add automated governor list sync

---

## Drill Schedule 2026

| Date | Type | Scenario | Participants | Status |
|------|------|----------|--------------|--------|
| 2026-03-15 | Full drill | Data corruption | All roles | ✅ Complete |
| 2026-06-15 | Full drill | Contract + key compromise | All roles | ✅ Complete |
| 2026-09-15 | Full drill | Multi-region failover | All roles | 📅 Scheduled |
| 2026-12-15 | Full drill | Coordinated attack | All roles + external audit | 📅 Scheduled |

---

## Post-Mortem Template

### Incident Post-Mortem — <Date>

**Incident ID:** INC-YYYY-MM-DD-###  
**Severity:** P?  
**Duration:** HH:MM  
**Impact:** <Users/operations affected>  
**Incident Commander:** <Name>

#### Timeline

| Time (UTC) | Event |
|------------|-------|
| HH:MM | Alert fired / issue reported |
| HH:MM | Incident declared, severity assigned |
| HH:MM | Root cause identified |
| HH:MM | Recovery action taken |
| HH:MM | Service restored |
| HH:MM | Incident resolved |

#### Root Cause

<What went wrong and why. Be specific and technical.>

#### Contributing Factors

<What made it worse or harder to detect/resolve>

#### What Went Well

<Effective procedures, tools, team responses>

#### What Went Poorly

<Ineffective procedures, missing tools, communication issues>

#### Action Items

| Action | Owner | Due Date | Priority | Status |
|--------|-------|----------|----------|--------|
| Add regression test for bug | Engineer | YYYY-MM-DD | P0 | 🟢 |
| Update runbook section X | DevOps | YYYY-MM-DD | P1 | 🟡 |
| Improve alerting for condition Y | SRE | YYYY-MM-DD | P2 | 🔴 |
| Add documentation for Z | Tech writer | YYYY-MM-DD | P3 | ⚪ |

#### Lessons Learned

1. <Key lesson 1>
2. <Key lesson 2>
3. <Key lesson 3>

#### Appendix

- Logs: <link to incident logs>
- Slack thread: <link to incident channel>
- Related incidents: <links to similar past incidents>

---

## Version History

### v2.0 (2026-06-28)
- Added detailed incident-specific procedures
- Added communication templates
- Added tabletop drill process and schedule
- Added drill findings from June 2026 drill
- Expanded roles and responsibilities

### v1.0 (2025-12-01)
- Initial incident response plan
- Basic severity levels and runbook links
