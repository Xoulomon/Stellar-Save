/**
 * regulatory_audit_trail.ts
 *
 * Regulatory-compliant audit trail for financial operations.
 * Covers immutable event logging, retention policies, and report generation.
 *
 * closes #1178
 */

import { createHash } from "crypto";

// ---------- Types ----------

export type FinancialEventType =
  | "group.created"
  | "member.joined"
  | "contribution.received"
  | "payout.executed"
  | "group.paused"
  | "group.unpaused"
  | "group.completed";

export interface FinancialAuditEvent {
  id: string;
  timestamp: string;          // ISO-8601
  eventType: FinancialEventType;
  actorAddress: string;
  groupId: number;
  amount?: string;            // in stroops
  recipient?: string;
  txHash?: string;
  metadata: Record<string, unknown>;
  hash: string;               // SHA-256 chain link
  prevHash: string;
}

export interface RetentionPolicy {
  retainDays: number;         // regulatory minimum (e.g. 7 years = 2555 days)
  archiveAfterDays: number;
}

export const DEFAULT_RETENTION: RetentionPolicy = {
  retainDays: 2555,           // 7 years
  archiveAfterDays: 365,
};

// ---------- In-memory store (replace with DB in production) ----------

const auditLog: FinancialAuditEvent[] = [];
let lastHash = "0".repeat(64);

// ---------- Immutable event recorder ----------

export function recordFinancialEvent(
  params: Omit<FinancialAuditEvent, "id" | "timestamp" | "hash" | "prevHash">,
): FinancialAuditEvent {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const timestamp = new Date().toISOString();
  const payload = [lastHash, id, params.actorAddress, params.eventType, params.groupId, timestamp].join("|");
  const hash = createHash("sha256").update(payload).digest("hex");

  const event: FinancialAuditEvent = { ...params, id, timestamp, hash, prevHash: lastHash };
  auditLog.push(event);
  lastHash = hash;
  return event;
}

// ---------- Integrity verification ----------

export function verifyAuditChain(): { valid: boolean; firstInvalidIndex?: number } {
  let prev = "0".repeat(64);
  for (let i = 0; i < auditLog.length; i++) {
    const e = auditLog[i];
    const payload = [prev, e.id, e.actorAddress, e.eventType, e.groupId, e.timestamp].join("|");
    const expected = createHash("sha256").update(payload).digest("hex");
    if (e.hash !== expected || e.prevHash !== prev) {
      return { valid: false, firstInvalidIndex: i };
    }
    prev = e.hash;
  }
  return { valid: true };
}

// ---------- Report generators ----------

export interface AuditReport {
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  totalEvents: number;
  totalContributions: number;
  totalPayouts: number;
  contributionVolumeStroops: bigint;
  payoutVolumeStroops: bigint;
  events: FinancialAuditEvent[];
}

export function generateRegulatoryReport(periodStart: Date, periodEnd: Date): AuditReport {
  const filtered = auditLog.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return t >= periodStart.getTime() && t <= periodEnd.getTime();
  });

  let contributionVolumeStroops = BigInt(0);
  let payoutVolumeStroops = BigInt(0);

  for (const e of filtered) {
    if (e.eventType === "contribution.received" && e.amount) {
      contributionVolumeStroops += BigInt(e.amount);
    }
    if (e.eventType === "payout.executed" && e.amount) {
      payoutVolumeStroops += BigInt(e.amount);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalEvents: filtered.length,
    totalContributions: filtered.filter((e) => e.eventType === "contribution.received").length,
    totalPayouts: filtered.filter((e) => e.eventType === "payout.executed").length,
    contributionVolumeStroops,
    payoutVolumeStroops,
    events: filtered,
  };
}

// ---------- Retention helper ----------

export function getEventsEligibleForArchive(policy = DEFAULT_RETENTION): FinancialAuditEvent[] {
  const archiveCutoff = Date.now() - policy.archiveAfterDays * 86_400_000;
  return auditLog.filter((e) => new Date(e.timestamp).getTime() < archiveCutoff);
}

export function getAuditLog(): readonly FinancialAuditEvent[] {
  return auditLog;
}
