/**
 * Insurance pool API helpers (Issue #1012).
 */

const API_BASE = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/api/v1';

export interface InsuranceClaim {
  id: string;
  groupId: string;
  claimant: string;
  amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  resolvedAt?: string;
}

export interface InsurancePool {
  groupId: string;
  enabled: boolean;
  balance: number;
  premiumRate: number;
  claims: InsuranceClaim[];
}

export async function fetchInsurancePool(groupId: string): Promise<InsurancePool> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/insurance`);
  if (!res.ok) throw new Error('Failed to fetch insurance pool');
  return res.json() as Promise<InsurancePool>;
}

export async function updateInsuranceSettings(
  groupId: string,
  payload: { enabled?: boolean; premiumRate?: number; initialBalance?: number },
): Promise<InsurancePool> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/insurance`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to update insurance settings');
  return res.json() as Promise<InsurancePool>;
}

export async function fileClaim(
  groupId: string,
  payload: { claimant: string; amount: number; reason: string },
): Promise<InsuranceClaim> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/insurance/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' })) as { error: string };
    throw new Error(err.error ?? 'Failed to file claim');
  }
  return res.json() as Promise<InsuranceClaim>;
}
