import { randomUUID } from 'crypto';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export type FlagReason = 'sanctioned_address' | 'high_value' | 'rapid_succession' | 'blacklist_match';

export interface ComplianceFlag {
  id: string;
  address: string;
  txHash: string;
  riskLevel: RiskLevel;
  reasons: FlagReason[];
  timestamp: string;
  reviewed: boolean;
  reviewedBy?: string;
  decision?: 'approved' | 'rejected';
  notes?: string;
}

export interface AmlCheckResult {
  flagged: boolean;
  riskLevel: RiskLevel;
  reasons: FlagReason[];
}

export const MOCK_SANCTIONED_ADDRESSES = new Set<string>([
  'GBADsanctioned1XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'GBADsanctioned2XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  'GBADBLACKLIST3XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
]);

export const HIGH_VALUE_THRESHOLD = 10000; // XLM

// Track recent transactions per address for rapid succession detection
const recentTxTimestamps: Map<string, number[]> = new Map();
const RAPID_SUCCESSION_WINDOW_MS = 60_000; // 1 minute
const RAPID_SUCCESSION_COUNT = 3;

const flagStore: ComplianceFlag[] = [];

export function screenTransaction(address: string, txHash: string, amount: number): AmlCheckResult {
  const reasons: FlagReason[] = [];

  if (MOCK_SANCTIONED_ADDRESSES.has(address)) {
    reasons.push('sanctioned_address');
  }

  if (amount > HIGH_VALUE_THRESHOLD) {
    reasons.push('high_value');
  }

  // Rapid succession check
  const now = Date.now();
  const timestamps = (recentTxTimestamps.get(address) ?? []).filter(
    (t) => now - t < RAPID_SUCCESSION_WINDOW_MS,
  );
  timestamps.push(now);
  recentTxTimestamps.set(address, timestamps);
  if (timestamps.length >= RAPID_SUCCESSION_COUNT) {
    reasons.push('rapid_succession');
  }

  const flagged = reasons.length > 0;
  let riskLevel = RiskLevel.LOW;
  if (reasons.includes('sanctioned_address')) {
    riskLevel = RiskLevel.CRITICAL;
  } else if (reasons.includes('rapid_succession') && reasons.includes('high_value')) {
    riskLevel = RiskLevel.HIGH;
  } else if (reasons.includes('high_value') || reasons.includes('rapid_succession')) {
    riskLevel = RiskLevel.MEDIUM;
  }

  return { flagged, riskLevel, reasons };
}

export function flagTransaction(address: string, txHash: string, result: AmlCheckResult): ComplianceFlag {
  const flag: ComplianceFlag = {
    id: randomUUID(),
    address,
    txHash,
    riskLevel: result.riskLevel,
    reasons: result.reasons,
    timestamp: new Date().toISOString(),
    reviewed: false,
  };
  flagStore.push(flag);
  return flag;
}

export function getFlaggedTransactions(): ComplianceFlag[] {
  return flagStore.filter((f) => !f.reviewed);
}

export function reviewFlag(id: string, reviewedBy: string, decision: 'approved' | 'rejected', notes?: string): void {
  const flag = flagStore.find((f) => f.id === id);
  if (!flag) throw new Error(`Flag ${id} not found`);
  flag.reviewed = true;
  flag.reviewedBy = reviewedBy;
  flag.decision = decision;
  flag.notes = notes;
}

export function getAuditLog(): ComplianceFlag[] {
  return [...flagStore];
}
