/**
 * Social recovery API helpers.
 *
 * Guardians are external Stellar addresses trusted by a member to co-sign
 * account recovery requests. The threshold determines how many guardian
 * approvals are required to execute a recovery.
 */

const API_BASE = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/api/v1';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GuardianConfig {
  owner: string;
  guardians: string[];
  threshold: number;
  updatedAt: number;
}

export type RecoveryRequestStatus = 'pending' | 'approved' | 'executed' | 'expired';

export interface RecoveryRequest {
  id: string;
  owner: string;
  newOwnerAddress: string;
  status: RecoveryRequestStatus;
  approvals: string[];   // guardian addresses that have approved
  threshold: number;
  guardians: string[];
  createdAt: number;
  expiresAt: number;
}

// ── Guardian config ───────────────────────────────────────────────────────────

export async function fetchGuardianConfig(ownerAddress: string): Promise<GuardianConfig | null> {
  const res = await fetch(`${API_BASE}/recovery/guardians/${encodeURIComponent(ownerAddress)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch guardian config');
  return res.json() as Promise<GuardianConfig>;
}

export async function setGuardians(
  ownerAddress: string,
  guardians: string[],
  threshold: number,
): Promise<GuardianConfig> {
  const res = await fetch(`${API_BASE}/recovery/guardians/${encodeURIComponent(ownerAddress)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guardians, threshold }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save guardians' })) as { error: string };
    throw new Error(err.error ?? 'Failed to save guardians');
  }
  return res.json() as Promise<GuardianConfig>;
}

// ── Recovery requests ─────────────────────────────────────────────────────────

/** Fetch pending recovery requests where the caller is a guardian. */
export async function fetchIncomingRequests(guardianAddress: string): Promise<RecoveryRequest[]> {
  const res = await fetch(
    `${API_BASE}/recovery/requests?guardian=${encodeURIComponent(guardianAddress)}`,
  );
  if (!res.ok) throw new Error('Failed to fetch recovery requests');
  const data = await res.json() as { requests: RecoveryRequest[] };
  return data.requests;
}

/** Fetch a recovery request's current status (for the account owner to poll). */
export async function fetchRecoveryRequest(requestId: string): Promise<RecoveryRequest> {
  const res = await fetch(`${API_BASE}/recovery/requests/${encodeURIComponent(requestId)}`);
  if (!res.ok) throw new Error('Recovery request not found');
  return res.json() as Promise<RecoveryRequest>;
}

/** Initiate a new recovery request for an account. */
export async function initiateRecovery(
  ownerAddress: string,
  newOwnerAddress: string,
): Promise<RecoveryRequest> {
  const res = await fetch(`${API_BASE}/recovery/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerAddress, newOwnerAddress }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to initiate recovery' })) as { error: string };
    throw new Error(err.error ?? 'Failed to initiate recovery');
  }
  return res.json() as Promise<RecoveryRequest>;
}

/** Guardian approves a recovery request. */
export async function approveRecovery(
  requestId: string,
  guardianAddress: string,
): Promise<RecoveryRequest> {
  const res = await fetch(`${API_BASE}/recovery/requests/${encodeURIComponent(requestId)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guardianAddress }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Approval failed' })) as { error: string };
    throw new Error(err.error ?? 'Approval failed');
  }
  return res.json() as Promise<RecoveryRequest>;
}
