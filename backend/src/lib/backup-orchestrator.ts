/**
 * Backup Orchestrator - Unified coordination of all backup activities.
 *
 * Consolidates scheduling, execution, monitoring, validation, and cleanup
 * into a single, cohesive orchestrator with clear lifecycle management.
 *
 * Addresses issue #1692 by eliminating timer duplication and providing
 * a single source of truth for backup configuration and state.
 */

import { logger } from '../logger';

import type { BackupService } from '../backup_service';
import type { BackupScheduler } from '../backup_scheduler';
import type { BackupMonitor } from '../backup_monitor';
import type { BackupRestoreDrill } from '../backup_restore_drill';

/**
 * Unified backup configuration - single source of truth for all backup settings.
 */
export interface BackupOrchestratorConfig {
  // ── Scheduling (BackupScheduler config) ────────────────────────────────
  fullBackupIntervalMs?: number;       // Default: 24h
  incrementalIntervalMs?: number;     // Default: 6h

  // ── Monitoring (BackupMonitor config) ──────────────────────────────────
  monitorCheckIntervalMs?: number;    // Default: 30min
  maxBackupAgeMs?: number;            // Default: 25h
  monitorAlertWebhookUrl?: string;

  // ── Restore Drill (BackupRestoreDrill config) ──────────────────────────
  drillCheckIntervalMs?: number;      // Default: 24h
  maxRestoreDurationMs?: number;      // Default: 5min
  drillAlertWebhookUrl?: string;

  // ── Retention (BackupService.pruneOldBackups config) ──────────────────
  pruneIntervalMs?: number;           // Default: 12h
  // retentionDays comes from config.backup.retentionDays

  // ── Logging & Diagnostics ─────────────────────────────────────────────
  enableDetailedLogging?: boolean;
}

/**
 * Backup activity event that can be emitted for monitoring/logging.
 */
export interface BackupActivityEvent {
  type: 'backup_started' | 'backup_completed' | 'backup_failed' | 'check_completed' | 'drill_completed' | 'prune_completed' | 'alert_generated';
  timestamp: number;
  component: 'scheduler' | 'service' | 'monitor' | 'drill' | 'pruner';
  details?: Record<string, unknown>;
}

/**
 * Listener for backup activity events.
 */
export type BackupActivityListener = (event: BackupActivityEvent) => void;

/**
 * BackupOrchestrator coordinates all backup-related activities.
 *
 * Responsibilities:
 * 1. Owns all timers (scheduling, monitoring, drilling, pruning)
 * 2. Manages startup/shutdown sequence
 * 3. Provides unified configuration
 * 4. Emits activity events for observability
 * 5. Coordinates alert delivery (currently to webhooks)
 *
 * Usage:
 * ```typescript
 * const orchestrator = new BackupOrchestrator(
 *   backupService,
 *   scheduler,
 *   monitor,
 *   drill,
 *   {
 *     fullBackupIntervalMs: 24 * 60 * 60 * 1000,
 *     incrementalIntervalMs: 6 * 60 * 60 * 1000,
 *     monitorCheckIntervalMs: 30 * 60 * 1000,
 *   }
 * );
 * orchestrator.start();
 * // ... later ...
 * orchestrator.stop();
 * ```
 */
export class BackupOrchestrator {
  private readonly service: BackupService;
  private readonly scheduler: BackupScheduler;
  private readonly monitor: BackupMonitor;
  private readonly drill: BackupRestoreDrill;
  private readonly config: Required<BackupOrchestratorConfig>;
  private readonly listeners: Set<BackupActivityListener> = new Set();

  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private monitorTimer: ReturnType<typeof setInterval> | null = null;
  private drillTimer: ReturnType<typeof setInterval> | null = null;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  private running = false;

  // Default configuration values
  private static readonly DEFAULTS: Required<BackupOrchestratorConfig> = {
    fullBackupIntervalMs: 24 * 60 * 60 * 1000,         // 24 hours
    incrementalIntervalMs: 6 * 60 * 60 * 1000,        // 6 hours
    monitorCheckIntervalMs: 30 * 60 * 1000,           // 30 minutes
    maxBackupAgeMs: 25 * 60 * 60 * 1000,              // 25 hours
    monitorAlertWebhookUrl: '',
    drillCheckIntervalMs: 24 * 60 * 60 * 1000,        // 24 hours
    maxRestoreDurationMs: 5 * 60 * 1000,              // 5 minutes
    drillAlertWebhookUrl: '',
    pruneIntervalMs: 12 * 60 * 60 * 1000,             // 12 hours
    enableDetailedLogging: false,
  };

  constructor(
    service: BackupService,
    scheduler: BackupScheduler,
    monitor: BackupMonitor,
    drill: BackupRestoreDrill,
    config: BackupOrchestratorConfig = {}
  ) {
    this.service = service;
    this.scheduler = scheduler;
    this.monitor = monitor;
    this.drill = drill;
    this.config = { ...BackupOrchestrator.DEFAULTS, ...config };
  }

  /**
   * Start all backup activities (scheduler, monitor, drill, pruner).
   * Call on application startup.
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('[BackupOrchestrator] Already running, ignoring start request');
      return;
    }

    this.running = true;
    logger.info('[BackupOrchestrator] Starting...', {
      fullBackupIntervalMs: this.config.fullBackupIntervalMs,
      incrementalIntervalMs: this.config.incrementalIntervalMs,
      monitorCheckIntervalMs: this.config.monitorCheckIntervalMs,
      drillCheckIntervalMs: this.config.drillCheckIntervalMs,
      pruneIntervalMs: this.config.pruneIntervalMs,
    });

    try {
      // Start scheduler: full backup immediately, then on interval
      await this.runSchedulerOnce('full');
      this.schedulerTimer = setInterval(() => {
        void this.runSchedulerCycle();
      }, Math.min(this.config.fullBackupIntervalMs, this.config.incrementalIntervalMs));

      // Start monitor: initial check, then on interval
      await this.runMonitorOnce();
      this.monitorTimer = setInterval(() => {
        void this.runMonitorOnce();
      }, this.config.monitorCheckIntervalMs);

      // Start drill: initial run, then on interval
      await this.runDrillOnce();
      this.drillTimer = setInterval(() => {
        void this.runDrillOnce();
      }, this.config.drillCheckIntervalMs);

      // Start pruner: on interval only (no initial run to avoid startup lag)
      this.pruneTimer = setInterval(() => {
        void this.runPruneOnce();
      }, this.config.pruneIntervalMs);
    } catch (err) {
      // Roll back partial startup so the orchestrator stays in a consistent state
      this.clearTimers();
      this.running = false;
      logger.error('[BackupOrchestrator] Startup failed:', err);
      throw err;
    }

    logger.info('[BackupOrchestrator] Started successfully');
    this.emit({
      type: 'backup_started',
      timestamp: Date.now(),
      component: 'scheduler',
      details: { stage: 'orchestrator_startup' },
    });
  }

  /**
   * Stop all backup activities.
   * Call on application shutdown.
   */
  stop(): void {
    if (!this.running) {
      logger.warn('[BackupOrchestrator] Not running, ignoring stop request');
      return;
    }

    this.clearTimers();

    this.running = false;
    logger.info('[BackupOrchestrator] Stopped');
  }

  /**
   * Check if orchestrator is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Register a listener for backup activity events.
   * Useful for metrics, logging, or external integrations.
   */
  addEventListener(listener: BackupActivityListener): void {
    this.listeners.add(listener);
  }

  /**
   * Unregister a listener.
   */
  removeEventListener(listener: BackupActivityListener): void {
    this.listeners.delete(listener);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Clear all timers and reset their handles to null.
   * Single place responsible for timer teardown.
   */
  private clearTimers(): void {
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    if (this.drillTimer) clearInterval(this.drillTimer);
    if (this.pruneTimer) clearInterval(this.pruneTimer);

    this.schedulerTimer = null;
    this.monitorTimer = null;
    this.drillTimer = null;
    this.pruneTimer = null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private timer callback methods
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Scheduler cycle: determine if it's time for full or incremental backup.
   * This runs every min(fullInterval, incrementalInterval) to handle both.
   */
  private async runSchedulerCycle(): Promise<void> {
    try {
      // Check if full backup is due
      if (this.scheduler.shouldRunFullBackup?.()) {
        await this.runSchedulerOnce('full');
      }
      // Check if incremental backup is due
      else if (this.scheduler.shouldRunIncrementalBackup?.()) {
        await this.runSchedulerOnce('incremental');
      }
    } catch (err) {
      logger.error('[BackupOrchestrator] Scheduler cycle failed:', err);
      this.emit({
        type: 'backup_failed',
        timestamp: Date.now(),
        component: 'scheduler',
        details: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  /**
   * Execute a single backup (full or incremental).
   */
  private async runSchedulerOnce(type: 'full' | 'incremental'): Promise<void> {
    try {
      if (this.config.enableDetailedLogging) {
        logger.debug(`[BackupOrchestrator] Triggering ${type} backup`);
      }

      const job = await this.scheduler.triggerManual(type);
      this.emit({
        type: 'backup_started',
        timestamp: Date.now(),
        component: 'scheduler',
        details: { jobId: job.id, backupType: job.type },
      });
    } catch (err) {
      logger.error(`[BackupOrchestrator] ${type} backup failed:`, err);
      this.emit({
        type: 'backup_failed',
        timestamp: Date.now(),
        component: 'scheduler',
        details: { backupType: type, error: err instanceof Error ? err.message : String(err) },
      });
      throw err;
    }
  }

  /**
   * Execute monitor checks once.
   */
  private async runMonitorOnce(): Promise<void> {
    try {
      if (this.config.enableDetailedLogging) {
        logger.debug('[BackupOrchestrator] Running monitor checks');
      }

      const alerts = await this.monitor.runChecks();
      if (alerts.length > 0) {
        this.emit({
          type: 'alert_generated',
          timestamp: Date.now(),
          component: 'monitor',
          details: { alertCount: alerts.length },
        });
      }

      this.emit({
        type: 'check_completed',
        timestamp: Date.now(),
        component: 'monitor',
        details: { alertsGenerated: alerts.length },
      });
    } catch (err) {
      logger.error('[BackupOrchestrator] Monitor check failed:', err);
      this.emit({
        type: 'backup_failed',
        timestamp: Date.now(),
        component: 'monitor',
        details: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  /**
   * Execute restore drill once.
   */
  private async runDrillOnce(): Promise<void> {
    try {
      if (this.config.enableDetailedLogging) {
        logger.debug('[BackupOrchestrator] Running restore drill');
      }

      const run = await this.drill.runDrill();
      this.emit({
        type: 'drill_completed',
        timestamp: Date.now(),
        component: 'drill',
        details: {
          drillId: run.id,
          status: run.status,
          durationMs: run.durationMs,
          exceededMaxDuration:
            typeof run.durationMs === 'number' && run.durationMs > this.config.maxRestoreDurationMs,
        },
      });
    } catch (err) {
      logger.error('[BackupOrchestrator] Restore drill failed:', err);
      this.emit({
        type: 'backup_failed',
        timestamp: Date.now(),
        component: 'drill',
        details: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  /**
   * Execute pruning once.
   */
  private async runPruneOnce(): Promise<void> {
    try {
      if (this.config.enableDetailedLogging) {
        logger.debug('[BackupOrchestrator] Running backup pruning');
      }

      const pruned = await this.service.pruneOldBackups();
      if (pruned > 0) {
        logger.info(`[BackupOrchestrator] Pruned ${pruned} old backups`);
      }

      this.emit({
        type: 'prune_completed',
        timestamp: Date.now(),
        component: 'service',
        details: { prunedCount: pruned },
      });
    } catch (err) {
      logger.error('[BackupOrchestrator] Pruning failed:', err);
      this.emit({
        type: 'backup_failed',
        timestamp: Date.now(),
        component: 'service',
        details: { error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  /**
   * Emit an activity event to all registered listeners.
   */
  private emit(event: BackupActivityEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        logger.error('[BackupOrchestrator] Event listener failed:', err);
      }
    }
  }
}
