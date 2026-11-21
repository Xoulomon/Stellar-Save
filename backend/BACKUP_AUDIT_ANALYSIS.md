# Backup Module Audit - Current State Analysis

## Issue #1692: Consolidate backup_monitor.ts, backup_scheduler.ts, backup_service.ts

### Executive Summary

Three backup-related modules exhibit overlapping responsibilities and unclear boundaries. This document maps current functionality and proposes a consolidated architecture.

---

## Module Responsibilities (Current State)

### 1. `backup_service.ts` - Core Execution Engine
**Primary Responsibility**: Execute backup operations and manage backup artifacts

**Key Capabilities**:
- `BackupService` class manages backup lifecycle
- `S3HttpClient` implements lightweight S3 operations (get/put/list/delete)
- `createBackup(type, baseId?)` - Initiates backup jobs asynchronously
- `runBackup(job)` - Internal: executes backup, collects data, writes to S3
- `getJob(id)` - Retrieves job by ID
- `listJobs()` - Lists all jobs in memory
- `getLatestCompleted(type?)` - Finds most recent successful backup
- `pruneOldBackups()` - Retention enforcement (deletes old backups from S3)

**Data Management**:
- Maintains in-memory `Map<jobId, BackupJob>`
- Metrics: `backupJobsTotal` (success/failure counts)
- No external persistence of job states

**Scope**: Single backup execution, S3 interaction, metrics recording

---

### 2. `backup_scheduler.ts` - Time-Based Triggering
**Primary Responsibility**: Schedule automatic backup creation at defined intervals

**Key Capabilities**:
- `BackupScheduler` class manages backup scheduling
- Configurable intervals: `fullBackupIntervalMs` (24h default), `incrementalIntervalMs` (6h default)
- `start()` - Launches timers, triggers full backup immediately
- `stop()` - Stops timers
- `isRunning()` - Reports scheduler state
- `triggerManual(type)` - User-initiated backup outside schedule
- Private: `runFull()` - Calls `service.createBackup('full')`
- Private: `runIncremental()` - Calls `service.createBackup('incremental', baseId)`

**Dependencies**:
- Depends on `BackupService` to execute backups
- Uses logger for audit trail

**Scope**: Scheduling logic, interval management, manual trigger support

---

### 3. `backup_monitor.ts` - Health & Alerts
**Primary Responsibility**: Monitor backup health and generate alerts

**Key Capabilities**:
- `BackupMonitor` class runs periodic health checks
- Configurable: `maxBackupAgeMs` (25h default), `checkIntervalMs` (30min default)
- `start()` - Launches check interval timer
- `stop()` - Stops timer
- `runChecks()` - Executes two checks:
  1. **Failed job check**: Finds failed backups, creates error alerts
  2. **Staleness check**: Ensures latest full backup < threshold age
- `getAlerts(unacknowledgedOnly?)` - Retrieves alerts
- `acknowledge(alertId)` - Marks alert as seen
- `sendWebhook(alert)` - Delivers alerts to optional webhook

**Dependencies**:
- Depends on `BackupService.listJobs()` and `getLatestCompleted('full')`
- Uses logger and HTTP client for webhooks

**Scope**: Health monitoring, alert generation & delivery, alert acknowledgment

---

### 4. `backup_restore_drill.ts` - Validation via Restore Test
**Primary Responsibility**: Periodically validate backup restorability

**Key Capabilities**:
- `BackupRestoreDrill` class runs periodic restore drills
- Uses `RecoveryService` to attempt restore of latest full backup
- `start()` - Launches drill interval timer
- `runDrill()` - Single drill execution:
  1. Fetches latest completed full backup
  2. Attempts restore to ephemeral target
  3. Validates integrity (checksum, record count, RTO compliance)
  4. Records results and generates alerts on failure
- `listRuns()` / `listAlerts()` - Retrieves drill history
- `acknowledge(alertId)` - Mark drill alerts as seen

**Dependencies**:
- Depends on `BackupService.getLatestCompleted('full')`
- Uses `RecoveryService` for restore logic
- Uses S3Client for object retrieval

**Scope**: Periodic restore testing, integrity validation, RTO/RPO monitoring

---

## Overlaps & Unclear Boundaries

### 1. **Timer Management Duplication**
- **Issue**: All three classes (`BackupScheduler`, `BackupMonitor`, `BackupRestoreDrill`) independently manage `setInterval()` timers
- **Problem**: No central lifecycle management, each has `start()` / `stop()` / `isRunning()`
- **Impact**: Harder to reason about startup sequence, interplay between timers

### 2. **Alert Generation Across Two Modules**
- **BackupMonitor**: Generates alerts for failed jobs and stale backups
- **BackupRestoreDrill**: Generates alerts for drill failures
- **Issue**: Two separate alert systems with different data structures (`BackupAlert` vs `RestoreDrillAlert`)
- **Problem**: Inconsistent alert interfaces, no unified alerting channel

### 3. **State Storage Inconsistency**
- **BackupService**: Keeps jobs in memory only (lost on restart)
- **BackupMonitor**: Keeps alerts in memory only
- **BackupRestoreDrill**: Keeps drill runs and alerts in memory only
- **Issue**: No persistent state for recovery/audit after restart
- **Impact**: Alert acknowledgments, drill history lost on server restart

### 4. **Configuration Scattered**
- **BackupService**: `retentionDays` from config
- **BackupScheduler**: `fullBackupIntervalMs`, `incrementalIntervalMs` 
- **BackupMonitor**: `maxBackupAgeMs`, `checkIntervalMs`
- **BackupRestoreDrill**: `maxRestoreDurationMs`, `checkIntervalMs`
- **Issue**: No unified backup config namespace
- **Problem**: Hard to tune backup strategy holistically

### 5. **Dependency Direction Unclear**
- **BackupScheduler** → **BackupService**: Clear (scheduler calls service)
- **BackupMonitor** → **BackupService**: Queries job state (reading, not triggering)
- **BackupRestoreDrill** → **BackupService**: Queries latest backup (reading, not triggering)
- **BackupRestoreDrill** → **RecoveryService**: Uses recovery logic
- **Issue**: Multiple readers of BackupService state; no event/notification pattern
- **Problem**: Tight coupling, monitoring lags actual state changes

### 6. **S3 Client Duplication**
- **BackupService**: Owns and instantiates `S3HttpClient`
- **BackupRestoreDrill**: Receives `S3Client` in constructor but `RecoveryService` may also create one
- **Issue**: Inconsistent S3 client lifecycle management
- **Problem**: Potential for multiple S3 client instances with redundant signing logic

### 7. **Pruning Logic Orphaned in BackupService**
- **BackupService.pruneOldBackups()**: Called manually (no automatic trigger visible)
- **Issue**: No lifecycle event for retention enforcement
- **Problem**: Can miss pruning if never called, or over-delete if called too frequently

---

## Proposed Consolidated Architecture

### Goal
Create a unified **Backup Orchestrator** that owns:
1. **Scheduling** (when to backup)
2. **Execution** (what happens during backup)
3. **Monitoring** (health checks, alerts)
4. **Validation** (restore drills)
5. **Cleanup** (retention enforcement)

### New Structure

```
┌─────────────────────────────────────────────────────┐
│         BackupOrchestrator (NEW)                    │
│  • Owns all timers                                  │
│  • Unified config object                           │
│  • Coordinates all backup activities               │
│  • Single alert channel                            │
└─────────────────────────────────────────────────────┘
         ↓ delegates to specialized services
         │
    ┌────┴─────┬────────┬──────────┐
    ↓          ↓        ↓          ↓
  Scheduler  Monitor  Drill     Service
  (triggers) (checks) (validates)(executes)
```

### Responsibilities After Consolidation

#### **BackupOrchestrator** (New Coordinator)
- Owns all intervals and timers
- Manages startup/shutdown sequence
- Unified alert dispatch
- Central backup configuration
- Coordinates between scheduler, monitor, drill, and service

#### **BackupService** (Refactored - Simplified)
- Only executes backups
- Only manages job lifecycle
- S3 abstraction unchanged
- No timers, no scheduling
- **Removed**: `pruneOldBackups()` (moved to Orchestrator)

#### **BackupScheduler** (Refactored - Simplified)
- Pure scheduling logic
- No timers (Orchestrator calls methods instead)
- Public: `getNextFullBackupTime()`, `getNextIncrementalTime()`
- Public: `shouldRunFullBackup()`, `shouldRunIncrementalBackup()`

#### **BackupMonitor** (Refactored - Simplified)
- Pure check logic
- No timers (Orchestrator calls methods instead)
- Public: `checkFailedJobs()`, `checkStaleBackups()` (return alerts instead of managing list)
- No webhook management (Orchestrator handles)

#### **BackupRestoreDrill** (Refactored - Simplified)
- Pure drill logic
- No timers (Orchestrator calls methods instead)
- Public: `performDrill()` (returns run result, not stored internally)
- Orchestrator stores and manages results

#### **BackupAlertChannel** (New Unified Interface)
- Single alert type combining all backup-related alerts
- Unified webhook delivery
- Acknowledgment tracking
- Persistent storage adapter (optional)

---

## Current Integration Points

### In `backup_restore_drill.ts`
```typescript
// Currently uses:
- backupService.getLatestCompleted('full')  // to find what to restore
- recovery.restore(jobId)                   // to perform restoration
- metrics (backupRestoreDrillsTotal, backupRestoreDrillDuration, backupRestoreLastSuccessfulTimestamp)
```

### In Application Startup
Currently, services are instantiated separately:
```typescript
const backupService = new BackupService();
const scheduler = new BackupScheduler(backupService);
const monitor = new BackupMonitor(backupService);
const drill = new BackupRestoreDrill(backupService, s3Client);

// Each managed independently
scheduler.start();
monitor.start();
drill.start();
```

---

## Risk Assessment

### Consolidation Benefits
✅ Single source of truth for backup configuration  
✅ Unified alert system  
✅ Cleaner lifecycle management  
✅ Easier to add features (e.g., backup versioning)  
✅ Better testability (mock orchestrator easier than three separate services)

### Consolidation Risks
⚠️ Larger refactoring required  
⚠️ Must preserve `backup_restore_drill.ts` integration  
⚠️ May need backward-compatibility wrapper during transition  
⚠️ Alert interface changes could break consumers

---

## Next Steps

1. **Design phase**: Finalize BackupOrchestrator interface
2. **Implementation**: Create orchestrator, refactor services
3. **Testing**: Verify restore drill still works end-to-end
4. **Integration**: Update startup code to use orchestrator
5. **Migration**: Gradual deprecation of direct service instantiation
