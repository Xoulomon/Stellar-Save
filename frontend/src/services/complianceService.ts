/**
 * Compliance Service
 *
 * Frontend API consumer for compliance/AML endpoints.
 * All responses follow the standard ApiResponseEnvelope shape: { data, meta, errors }
 */

import { apiRequest } from './apiClient';

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export type FlagReason =
  'sanctioned_address' | 'high_value' | 'rapid_succession' | 'blacklist_match';

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
  return (
    (await apiRequest<AmlCheckResult>('/compliance/screen', {
      method: 'POST',
      authenticated: true,
      errorLabel: 'screen transaction',
      body: {
        address,
        txHash,
        amount,
      },
    })) || { flagged: false, riskLevel: RiskLevel.LOW, reasons: [] }
  );
}

/**
 * Get flagged transactions queue (requires admin auth)
 * @returns List of flagged transactions pending review
 */
export async function getFlaggedTransactions(): Promise<ComplianceFlag[]> {
  return (
    (await apiRequest<ComplianceFlag[]>('/compliance/queue', {
      authenticated: true,
      errorLabel: 'fetch flagged transactions',
    })) || []
  );
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
  return (
    (
      await apiRequest<{ reviewed: boolean }>(
        `/compliance/flags/${encodeURIComponent(flagId)}/review`,
        {
          method: 'POST',
          authenticated: true,
          errorLabel: 'review flag',
          body: {
            decision,
            notes,
          },
        }
      )
    )?.reviewed || false
  );
}

/**
 * Get audit log (requires admin auth)
 * @returns List of all compliance flags and reviews
 */
export async function getAuditLog(): Promise<ComplianceFlag[]> {
  return (
    (await apiRequest<ComplianceFlag[]>('/compliance/audit-log', {
      authenticated: true,
      errorLabel: 'fetch audit log',
    })) || []
  );
}
