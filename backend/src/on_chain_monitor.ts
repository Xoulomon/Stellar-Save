/**
 * On-Chain Anomaly Monitor — Issue #1108
 *
 * Polls indexed ContractEvent records and fires alerts when configured
 * thresholds are breached.  Alert types:
 *
 *   LARGE_PAYOUT          — single payout exceeds the configured threshold
 *   PAYOUT_SPIKE          — payout count > N in a rolling window
 *   ERROR_SPIKE           — contract error events > N in a rolling window
 *   ADMIN_ACTION          — any admin/pause/unpause event
 *   REPEATED_REVERT       — revert events > N in a rolling window
 *
 * Each alert type increments a labelled Prometheus counter so Alertmanager
 * rules can route to on-call channels.  A circuit-breaker recommendation is
 * attached to CRITICAL severity alerts.
 *
 * Runbooks: docs/runbooks/on-chain-*.md
 */
import { prisma } from './prisma_client';
import { logger } from './logger';
import { Counter, Gauge } from 'prom-client';
import { registry } from './metrics';

// ── Prometheus metrics ────────────────────────────────────────────────────────

export const onChainAlertsTotal = new Counter({
  name: 'on_chain_alerts_total',
  help: 'Total on-chain anomaly alerts fired',
  labelNames: ['alert_type', 'severity'],
  registers: [registry],
});

export const onChainLargePayoutXlm = new Gauge({
  name: 'on_chain_large_payout_xlm',
  help: 'XLM amount of the most recently detected large payout',
  registers: [registry],
});

export const onChainMonitorLastRunTs = new Gauge({
  name: 'on_chain_monitor_last_run_timestamp_seconds',
  help: 'Unix timestamp of the last on-chain monitor check',
  registers: [registry],
});

// ── Alert types / severities ──────────────────────────────────────────────────

export type AlertSeverity = 'warning' | 'critical';

export interface OnChainAlert {
  type: string;
  severity: AlertSeverity;
  message: string;
  /** Circuit-breaker recommendation included for critical alerts. */
  circuitBreakerAction?: string;
  metadata: Record<string, unknown>;
  runbook: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface MonitorConfig {
  /** Amount (in stroops, i.e. 1 XLM = 10_000_000) above which a single payout is flagged. */
  largePayoutThresholdStroops: bigint;
  /** Number of payouts in rollingWindowMs to trigger a payout spike alert. */
  payoutSpikeThreshold: number;
  /** Number of error events in rollingWindowMs to trigger an error spike alert. */
  errorSpikeThreshold: number;
  /** Number of reverts in rollingWindowMs to trigger a repeated-revert alert. */
  revertThreshold: number;
  /** Rolling window in milliseconds (default 5 minutes). */
  rollingWindowMs: number;
  /** How often to run the monitor loop in milliseconds (default 60 seconds). */
  pollIntervalMs: number;
}

const DEFAULT_CONFIG: MonitorConfig = {
  largePayoutThresholdStroops: BigInt(100_000_000_000), // 10 000 XLM
  payoutSpikeThreshold: 10,
  errorSpikeThreshold: 5,
  revertThreshold: 3,
  rollingWindowMs: 5 * 60 * 1000,
  pollIntervalMs: 60 * 1000,
};

// ── Event-type helpers ────────────────────────────────────────────────────────

const ADMIN_EVENTS = new Set(['pause_group', 'unpause_group', 'admin', 'admin_action', 'set_admin']);
const PAYOUT_EVENTS = new Set(['payout', 'payout_received', 'payoutreceived', 'payout_processed']);
const ERROR_EVENTS = new Set(['error', 'contract_error', 'failed', 'revert']);
const REVERT_EVENTS = new Set(['revert', 'tx_failed', 'invocation_failed']);

function normalise(t: string): string {
  return t.toLowerCase().replace(/-/g, '_');
}
function isAdmin(t: string): boolean { return ADMIN_EVENTS.has(normalise(t)); }
function isPayout(t: string): boolean { return PAYOUT_EVENTS.has(normalise(t)); }
function isError(t: string): boolean { return ERROR_EVENTS.has(normalise(t)); }
function isRevert(t: string): boolean { return REVERT_EVENTS.has(normalise(t)); }

// ── Monitor class ─────────────────────────────────────────────────────────────

export class OnChainMonitor {
  private cfg: MonitorConfig;
  private running = false;
  private timer?: ReturnType<typeof setTimeout>;

  /** Optional sink for alerts (e.g. webhook, PagerDuty). Defaults to logger. */
  private alertSink: (alert: OnChainAlert) => Promise<void>;

  constructor(cfg: Partial<MonitorConfig> = {}, alertSink?: (a: OnChainAlert) => Promise<void>) {
    this.cfg = { ...DEFAULT_CONFIG, ...cfg };
    this.alertSink = alertSink ?? this.defaultSink.bind(this);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    logger.info('[OnChainMonitor] Started', { pollIntervalMs: this.cfg.pollIntervalMs });
    void this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    logger.info('[OnChainMonitor] Stopped');
  }

  /** Run one check cycle — exposed for tests. */
  async check(): Promise<OnChainAlert[]> {
    const since = new Date(Date.now() - this.cfg.rollingWindowMs);

    const events = await prisma.contractEvent.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    const alerts: OnChainAlert[] = [];

    const payouts = events.filter((e) => isPayout(e.eventType));
    const errors = events.filter((e) => isError(e.eventType));
    const reverts = events.filter((e) => isRevert(e.eventType));
    const adminActions = events.filter((e) => isAdmin(e.eventType));

    // 1. Large single payout
    for (const p of payouts) {
      const data = p.data as Record<string, unknown>;
      const amountRaw = data?.amount ?? data?.value;
      const amount = amountRaw ? BigInt(String(amountRaw)) : 0n;
      if (amount >= this.cfg.largePayoutThresholdStroops) {
        const xlm = Number(amount) / 1e7;
        onChainLargePayoutXlm.set(xlm);
        alerts.push({
          type: 'LARGE_PAYOUT',
          severity: 'critical',
          message: `Large payout detected: ${xlm.toFixed(2)} XLM (tx: ${p.txHash})`,
          circuitBreakerAction: 'Consider calling pause_group on the affected contract until the payout is manually verified.',
          metadata: { txHash: p.txHash, amountXlm: xlm, ledgerSeq: p.ledgerSeq },
          runbook: 'https://github.com/ComputerOracle/Stellar-Save/blob/main/docs/runbooks/on-chain-large-payout.md',
        });
      }
    }

    // 2. Payout spike
    if (payouts.length >= this.cfg.payoutSpikeThreshold) {
      alerts.push({
        type: 'PAYOUT_SPIKE',
        severity: 'warning',
        message: `${payouts.length} payouts in the last ${this.cfg.rollingWindowMs / 60000} minutes`,
        metadata: { count: payouts.length, windowMinutes: this.cfg.rollingWindowMs / 60000 },
        runbook: 'https://github.com/ComputerOracle/Stellar-Save/blob/main/docs/runbooks/on-chain-payout-spike.md',
      });
    }

    // 3. Error spike
    if (errors.length >= this.cfg.errorSpikeThreshold) {
      const severity: AlertSeverity = errors.length >= this.cfg.errorSpikeThreshold * 3 ? 'critical' : 'warning';
      alerts.push({
        type: 'ERROR_SPIKE',
        severity,
        message: `${errors.length} contract error events in the last ${this.cfg.rollingWindowMs / 60000} minutes`,
        ...(severity === 'critical' ? {
          circuitBreakerAction: 'Halt new group creation and contributions via feature flag until root cause is identified.',
        } : {}),
        metadata: { count: errors.length },
        runbook: 'https://github.com/ComputerOracle/Stellar-Save/blob/main/docs/runbooks/on-chain-error-spike.md',
      });
    }

    // 4. Repeated reverts
    if (reverts.length >= this.cfg.revertThreshold) {
      alerts.push({
        type: 'REPEATED_REVERT',
        severity: 'warning',
        message: `${reverts.length} transaction reverts in the last ${this.cfg.rollingWindowMs / 60000} minutes`,
        metadata: { count: reverts.length },
        runbook: 'https://github.com/ComputerOracle/Stellar-Save/blob/main/docs/runbooks/on-chain-reverts.md',
      });
    }

    // 5. Admin actions — always alert (any occurrence)
    for (const a of adminActions) {
      alerts.push({
        type: 'ADMIN_ACTION',
        severity: 'warning',
        message: `Admin action detected: ${a.eventType} (tx: ${a.txHash})`,
        metadata: { eventType: a.eventType, txHash: a.txHash, ledgerSeq: a.ledgerSeq },
        runbook: 'https://github.com/ComputerOracle/Stellar-Save/blob/main/docs/runbooks/on-chain-admin-action.md',
      });
    }

    // Emit metrics and fire sinks for each alert
    for (const alert of alerts) {
      onChainAlertsTotal.inc({ alert_type: alert.type, severity: alert.severity });
      await this.alertSink(alert);
    }

    onChainMonitorLastRunTs.set(Date.now() / 1000);
    return alerts;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    if (!this.running) return;
    try {
      await this.check();
    } catch (err) {
      logger.error('[OnChainMonitor] Check failed', { error: String(err) });
    }
    this.timer = setTimeout(() => void this.tick(), this.cfg.pollIntervalMs);
  }

  private async defaultSink(alert: OnChainAlert): Promise<void> {
    const fn = alert.severity === 'critical' ? 'error' : 'warn';
    logger[fn](`[OnChainMonitor] ${alert.type}`, {
      severity: alert.severity,
      message: alert.message,
      runbook: alert.runbook,
      ...(alert.circuitBreakerAction ? { circuitBreakerAction: alert.circuitBreakerAction } : {}),
      metadata: alert.metadata,
    });
  }
}
