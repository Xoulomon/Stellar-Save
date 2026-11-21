/**
 * GovernancePage — Issue #1013
 *
 * - Proposals list with status badges (active / passed / executed / expired)
 * - Proposal detail panel with vote tally and vote action
 * - Timelock countdown for passed-but-not-yet-executed proposals
 * - Vote action restricted to connected governor wallets (read-only for others)
 *
 * The page is a composition layer only: the widgets live in
 * `components/governance/` and their data access in
 * `hooks/useGovernanceQueries.ts`.
 */
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import { Alert, AppCard, Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import {
  ProposalCard,
  ProposalDetailDialog,
  STATUS_TABS,
} from '../components/governance';
import { useGovernorsQuery, useProposalsQuery } from '../hooks/useGovernanceQueries';
import { useWallet } from '../hooks/useWallet';
import { AppLayout } from '../ui';

import type { Proposal, ProposalStatus } from '../utils/governanceApi';

export default function GovernancePage() {
  const { activeAddress } = useWallet();
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');

  const { data: proposals = [], isLoading, error } = useProposalsQuery();
  const { data: governors = [] } = useGovernorsQuery();

  const isGovernor = Boolean(activeAddress && governors.includes(activeAddress));

  const filtered =
    statusFilter === 'all' ? proposals : proposals.filter((p) => p.status === statusFilter);

  return (
    <AppLayout
      title="Governance"
      subtitle="Protocol-level proposals — view, vote, and track"
      footerText="Stellar Save"
    >
      <Stack spacing={3}>
        {!activeAddress && (
          <Alert severity="info">Connect your Freighter wallet to see your governor status.</Alert>
        )}
        {activeAddress && !isGovernor && (
          <Alert severity="info">
            Your wallet (<code>{activeAddress.slice(0, 8)}…</code>) is not a governor. Proposals are
            read-only.
          </Alert>
        )}
        {isGovernor && (
          <Alert severity="success" icon={<HowToVoteIcon />}>
            You are a governor. You can vote on active proposals.
          </Alert>
        )}

        <AppCard>
          {/* Status filter tabs */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
            {STATUS_TABS.map((tab) => (
              <Chip
                key={tab.value}
                label={tab.label}
                onClick={() => setStatusFilter(tab.value)}
                color={statusFilter === tab.value ? 'primary' : 'default'}
                variant={statusFilter === tab.value ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>

          {isLoading && <LinearProgress />}
          {error && <Alert severity="error">Failed to load proposals. Please try again.</Alert>}

          {!isLoading && filtered.length === 0 && (
            <Typography color="text.secondary" textAlign="center" sx={{ py: 4 }}>
              No proposals found.
            </Typography>
          )}

          <Stack spacing={2}>
            {filtered.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                isGovernor={isGovernor}
                onClick={() => setSelected(proposal)}
              />
            ))}
          </Stack>
        </AppCard>
      </Stack>

      {selected && (
        <ProposalDetailDialog
          proposal={selected}
          isGovernor={isGovernor}
          voterAddress={activeAddress ?? ''}
          onClose={() => setSelected(null)}
          onVoted={setSelected}
        />
      )}
    </AppLayout>
  );
}
