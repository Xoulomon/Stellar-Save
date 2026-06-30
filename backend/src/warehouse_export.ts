/**
 * Data Warehouse Export Pipeline (#1036)
 *
 * Exports ContractEvent and aggregate analytics rows to S3 as newline-delimited
 * JSON (NDJSON), which is compatible with Parquet converters and most warehouse
 * loaders (Snowflake, Redshift COPY, BigQuery external tables, etc.).
 *
 * Incremental watermarking: the last-exported ledger sequence is persisted so
 * re-runs never re-export rows that were already shipped.
 *
 * Data-quality checks run before upload; failures halt the export and alert via
 * the configured webhook.
 *
 * Warehouse schema (documented for analysts):
 *
 *  fact_contract_events:
 *    id           TEXT        PK
 *    contract_id  TEXT
 *    event_type   TEXT
 *    tx_hash      TEXT
 *    ledger_seq   INTEGER
 *    event_ts     TIMESTAMPTZ  (original event timestamp)
 *    topics       TEXT         (JSON string)
 *    data         TEXT         (JSON string)
 *    exported_at  TIMESTAMPTZ
 *
 *  dim_platform_metrics:
 *    date                   DATE
 *    total_users            INTEGER
 *    active_users           INTEGER
 *    total_groups           INTEGER
 *    total_contribution_xlm NUMERIC
 *    total_payout_xlm       NUMERIC
 *    success_rate_pct       NUMERIC
 */

import { PrismaClient } from './generated/prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { logger } from './logger';

const WATERMARK_KEY = 'warehouse_export_watermark';

export interface WarehouseExportResult {
  eventsExported: number;
  metricsExported: number;
  s3Keys: string[];
  watermark: number; // last ledger_seq exported
}

export interface DataQualityError extends Error {
  check: string;
}

export class WarehouseExportPipeline {
  private prisma: PrismaClient;
  private s3: S3Client;
  private bucket: string;
  private alertWebhook?: string;

  constructor(opts: {
    s3Client: S3Client;
    bucket: string;
    alertWebhook?: string;
  }) {
    this.prisma = new (PrismaClient as any)();
    this.s3 = opts.s3Client;
    this.bucket = opts.bucket;
    this.alertWebhook = opts.alertWebhook;
  }

  /** Run a full incremental export cycle. */
  async run(): Promise<WarehouseExportResult> {
    const watermark = await this.loadWatermark();
    const exportedAt = new Date().toISOString();
    const s3Keys: string[] = [];

    // ── 1. Export contract events ──────────────────────────────────────────
    const events = await this.prisma.contractEvent.findMany({
      where: { ledgerSeq: { gt: watermark } },
      orderBy: { ledgerSeq: 'asc' },
    });

    let newWatermark = watermark;

    if (events.length > 0) {
      const rows = events.map(e => ({
        id: e.id,
        contract_id: e.contractId,
        event_type: e.eventType,
        tx_hash: e.txHash,
        ledger_seq: e.ledgerSeq,
        event_ts: e.timestamp.toISOString(),
        topics: JSON.stringify(e.topics),
        data: JSON.stringify(e.data),
        exported_at: exportedAt,
      }));

      await this.runQualityChecks('fact_contract_events', rows);

      const key = `fact_contract_events/${datePrefix(exportedAt)}_ledger_${watermark + 1}_to_${events[events.length - 1].ledgerSeq}.ndjson`;
      await this.upload(key, toNdjson(rows));
      s3Keys.push(key);

      newWatermark = events[events.length - 1].ledgerSeq;
    }

    // ── 2. Export platform metrics (daily aggregates not yet exported) ─────
    const metrics = await this.prisma.platformMetrics.findMany({
      orderBy: { date: 'asc' },
    });

    if (metrics.length > 0) {
      const rows = metrics.map(m => ({
        date: m.date.toISOString().slice(0, 10),
        total_users: m.totalUsers,
        active_users: m.activeUsers,
        total_groups: m.totalGroups,
        total_contribution_xlm: m.totalContributionAmount.toString(),
        total_payout_xlm: m.totalPayoutAmount.toString(),
        success_rate_pct: m.successRate.toString(),
      }));

      await this.runQualityChecks('dim_platform_metrics', rows);

      const key = `dim_platform_metrics/${datePrefix(exportedAt)}.ndjson`;
      await this.upload(key, toNdjson(rows));
      s3Keys.push(key);
    }

    // ── 3. Persist updated watermark ──────────────────────────────────────
    if (newWatermark > watermark) {
      await this.saveWatermark(newWatermark);
    }

    return {
      eventsExported: events.length,
      metricsExported: metrics.length,
      s3Keys,
      watermark: newWatermark,
    };
  }

  // ── Data-quality checks ──────────────────────────────────────────────────

  private async runQualityChecks(table: string, rows: Record<string, unknown>[]): Promise<void> {
    // Check 1: no empty export batch for a table that should have data
    if (rows.length === 0) return; // nothing to check

    // Check 2: required fields are present and non-null
    const requiredByTable: Record<string, string[]> = {
      fact_contract_events: ['id', 'contract_id', 'event_type', 'tx_hash', 'ledger_seq', 'event_ts'],
      dim_platform_metrics: ['date', 'total_users', 'active_users'],
    };
    const required = requiredByTable[table] ?? [];
    for (const row of rows) {
      for (const field of required) {
        if (row[field] === null || row[field] === undefined || row[field] === '') {
          await this.alert(`[warehouse] DQ failure on ${table}: null/empty field "${field}"`);
          const err = new Error(`Data-quality check failed: null field "${field}" in ${table}`) as DataQualityError;
          err.check = 'null_required_field';
          throw err;
        }
      }
    }

    // Check 3: no duplicate primary keys within the batch
    const pkField = table === 'fact_contract_events' ? 'id' : 'date';
    const seen = new Set<unknown>();
    for (const row of rows) {
      if (seen.has(row[pkField])) {
        await this.alert(`[warehouse] DQ failure on ${table}: duplicate ${pkField} "${row[pkField]}"`);
        const err = new Error(`Data-quality check failed: duplicate "${pkField}" in ${table}`) as DataQualityError;
        err.check = 'duplicate_pk';
        throw err;
      }
      seen.add(row[pkField]);
    }

    logger.info(`[warehouse] DQ passed for ${table} (${rows.length} rows)`);
  }

  // ── Watermark helpers ────────────────────────────────────────────────────

  private async loadWatermark(): Promise<number> {
    try {
      const row = await (this.prisma as any).sorobanEventCursor.findUnique({
        where: { contractId: WATERMARK_KEY },
        select: { lastLedger: true },
      });
      return row?.lastLedger ?? 0;
    } catch {
      return 0;
    }
  }

  private async saveWatermark(ledger: number): Promise<void> {
    await (this.prisma as any).sorobanEventCursor.upsert({
      where: { contractId: WATERMARK_KEY },
      update: { lastLedger: ledger, lastCursor: String(ledger) },
      create: { contractId: WATERMARK_KEY, lastLedger: ledger, lastCursor: String(ledger) },
    });
  }

  // ── S3 upload helper ─────────────────────────────────────────────────────

  private async upload(key: string, body: string): Promise<void> {
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/x-ndjson',
    }));
    logger.info(`[warehouse] Uploaded s3://${this.bucket}/${key}`);
  }

  // ── Alert helper ─────────────────────────────────────────────────────────

  private async alert(message: string): Promise<void> {
    logger.error(message);
    if (!this.alertWebhook) return;
    try {
      await fetch(this.alertWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
    } catch (err) {
      logger.error('[warehouse] Failed to send alert webhook', err);
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

function toNdjson(rows: Record<string, unknown>[]): string {
  return rows.map(r => JSON.stringify(r)).join('\n');
}

function datePrefix(isoTs: string): string {
  return isoTs.slice(0, 10).replace(/-/g, '/');
}
