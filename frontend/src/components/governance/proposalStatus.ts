import type { ProposalStatus } from '../../utils/governanceApi';

/** Chip colour per proposal status. */
export const STATUS_COLOR: Record<
  ProposalStatus,
  'default' | 'primary' | 'success' | 'error' | 'warning'
> = {
  active: 'primary',
  passed: 'warning',
  executed: 'success',
  rejected: 'error',
  expired: 'default',
};

/** Status filter tabs shown above the proposal list. */
export const STATUS_TABS: Array<{ label: string; value: ProposalStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Passed', value: 'passed' },
  { label: 'Executed', value: 'executed' },
  { label: 'Expired / Rejected', value: 'expired' },
];

/** True while a proposal still accepts votes. */
export function isVotingOpen(proposal: { status: ProposalStatus; votingEndsAt: number }): boolean {
  return proposal.status === 'active' && Date.now() < proposal.votingEndsAt;
}
