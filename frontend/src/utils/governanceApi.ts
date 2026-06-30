/**
 * Governance API helpers (Issue #1013).
 */

const API_BASE = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/api/v1';

export type ProposalStatus = 'active' | 'passed' | 'rejected' | 'executed' | 'expired';

export interface Vote {
  voter: string;
  support: boolean;
  votedAt: string;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  votes: Vote[];
  votingEndsAt: number;      // Unix ms
  timelockEndsAt?: number;   // Unix ms — only for 'passed'
  createdAt: string;
  executedAt?: string;
}

export async function fetchProposals(): Promise<Proposal[]> {
  const res = await fetch(`${API_BASE}/governance/proposals`);
  if (!res.ok) throw new Error('Failed to fetch proposals');
  const data = await res.json() as { proposals: Proposal[] };
  return data.proposals;
}

export async function fetchProposal(id: string): Promise<Proposal> {
  const res = await fetch(`${API_BASE}/governance/proposals/${id}`);
  if (!res.ok) throw new Error('Proposal not found');
  return res.json() as Promise<Proposal>;
}

export async function fetchGovernors(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/governance/governors`);
  if (!res.ok) throw new Error('Failed to fetch governors');
  const data = await res.json() as { governors: string[] };
  return data.governors;
}

export async function castVote(
  proposalId: string,
  voter: string,
  support: boolean,
): Promise<Proposal> {
  const res = await fetch(`${API_BASE}/governance/proposals/${proposalId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voter, support }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Vote failed' })) as { error: string };
    throw new Error(err.error ?? 'Vote failed');
  }
  return res.json() as Promise<Proposal>;
}
