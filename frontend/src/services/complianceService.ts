/**
 * Compliance Service
 *
 * Frontend API consumer for compliance/AML endpoints.
 * All responses follow the standard ApiResponseEnvelope shape: { data, meta, errors }
 */

import { env } from '../lib/env';

const API_BASE_URL = env.VITE_API_URL || 'http://localhost:3000/api/v1';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export type FlagReason = 'sanctioned_address' | 'high_value' | 'rapid_succession' | 'blacklist_match';

export interface AmlCheckResult {
  flagged: boolean;
  riskLevel: RiskLevel;
  reasons: FlagReason[];
}

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

/**
 * Generic response envelope type
 */
interface ApiResponseEnvelope<T> {
  data: T | null;
  meta?: Record<string, unknown>;
  errors?: Array<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Screen a transaction for compliance (requires JWT)
 * @param address - Stellar address
 * @param txHash - Transaction hash
 * @param amount - Transaction amount
 * @returns AML check result
 */
export async function screenTransaction(
  address: string,
  txHash: string,
  amount: number
): Promise<AmlCheckResult> {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/compliance/screen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      address,
      txHash,
      amount,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to screen transaction: ${response.statusText}`);
  }

  const envelope = (await response.json()) as ApiResponseEnvelope<AmlCheckResult>;

  if (envelope.errors && envelope.errors.length > 0) {
    throw new Error(envelope.errors[0].message);
  }

  return envelope.data || { flagged: false, riskLevel: RiskLevel.LOW, reasons: [] };
}

/**
 * Get flagged transactions queue (requires admin auth)
 * @returns List of flagged transactions pending review
 */
export async function getFlaggedTransactions(): Promise<ComplianceFlag[]> {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/compliance/queue`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch flagged transactions: ${response.statusText}`);
  }

  const envelope = (await response.json()) as ApiResponseEnvelope<ComplianceFlag[]>;

  if (envelope.errors && envelope.errors.length > 0) {
    throw new Error(envelope.errors[0].message);
  }

  return envelope.data || [];
}

/**
 * Review a flagged transaction (requires admin auth)
 * @param flagId - Flag ID to review
 * @param decision - Approval decision ('approved' or 'rejected')
 * @param notes - Optional review notes
 * @returns Success indicator
 */
export async function reviewFlag(
  flagId: string,
  decision: 'approved' | 'rejected',
  notes?: string
): Promise<boolean> {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/compliance/flags/${flagId}/review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      decision,
      notes,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to review flag: ${response.statusText}`);
  }

  const envelope = (await response.json()) as ApiResponseEnvelope<{ reviewed: boolean }>;

  if (envelope.errors && envelope.errors.length > 0) {
    throw new Error(envelope.errors[0].message);
  }

  return envelope.data?.reviewed || false;
}

/**
 * Get audit log (requires admin auth)
 * @returns List of all compliance flags and reviews
 */
export async function getAuditLog(): Promise<ComplianceFlag[]> {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/compliance/audit-log`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch audit log: ${response.statusText}`);
  }

  const envelope = (await response.json()) as ApiResponseEnvelope<ComplianceFlag[]>;

  if (envelope.errors && envelope.errors.length > 0) {
    throw new Error(envelope.errors[0].message);
  }

  return envelope.data || [];
}
