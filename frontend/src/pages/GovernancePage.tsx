/**
 * GovernancePage — Issue #1013
 *
 * - Proposals list with status badges (active / passed / executed / expired)
 * - Proposal detail panel with vote tally and vote action
 * - Timelock countdown for passed-but-not-yet-executed proposals
 * - Vote action restricted to connected governor wallets (read-only for others)
 */
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Stack, Typography, Box, Chip, Alert, LinearProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Divider, Tooltip,
} from '@mui/material';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import LockClockIcon from '@mui/icons-material/LockClock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { AppCard, AppLayout } from '../ui';
import { Button } from '../components/Button';
import { useWallet } from '../hooks/useWallet';
import { queryKeys } from '../lib/queryKeys';
import {
  fetchProposals, fetchGovernors, castVote,
} from '../utils/governanceApi';
import type { Proposal, ProposalStatus } from '../utils/governanceApi';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ProposalStatus, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  active: 'primary',
  passed: 'warning',
  executed: 'success',
  rejected: 'error',
  expired: 'default',
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Elapsed';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${Math.floor(s % 60)}s`;
}

function VoteTally({ proposal }: { proposal: Proposal }) {
  const total = proposal.votesFor + proposal.votesAgainst;
  const pct = total > 0 ? Math.round((proposal.votesFor / total) * 100) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="success.main">For: {proposal.votesFor}</Typography>
        <Typography variant="caption" color="error.main">Against: {proposal.votesAgainst}</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        color="success"
        sx={{ height: 8, borderRadius: 4, bgcolor: 'error.light' }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        {pct}% in favour · {total} vote{total !== 1 ? 's' : ''} cast
      </Typography>
    </Box>
  );
}

function TimelockCountdown({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = endsAt - now;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
      <LockClockIcon fontSize="small" color="warning" />
      <Typography variant="body2" color="warning.main" fontWeight={600}>
        Timelock: {remaining > 0 ? formatCountdown(remaining) + ' remaining' : 'Unlocked — ready to execute'}
      </Typography>
    </Box>
  );
}

// ── Proposal detail dialog ────────────────────────────────────────────────────

interface DetailDialogProps {
  proposal: Proposal;
  isGovernor: boolean;
  voterAddress: string;
  onClose: () => void;
  onVoted: (updated: Proposal) => void;
}

function ProposalDetailDialog({ proposal: initial, isGovernor, voterAddress, onClose, onVoted }: DetailDialogProps) {
  const qc = useQueryClient();
  const [proposal, setProposal] = useState(initial);
  const [voteError, setVoteError] = useState<string | null>(null);

  const hasVoted = proposal.votes.some((v) => v.voter === voterAddress);

  const mutation = useMutation({
    mutationFn: (support: boolean) => castVote(proposal.id, voterAddress, support),
    onSuccess: (updated) => {
      setProposal(updated);
      onVoted(updated);
      qc.invalidateQueries({ queryKey: queryKeys.governance.proposals() });
      setVoteError(null);
    },
    onError: (e: Error) => setVoteError(e.message),
  });

  const votingOpen = proposal.status === 'active' && Date.now() < proposal.votingEndsAt;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HowToVoteIcon />
        {proposal.title}
        <Chip label={proposal.status} size="small" color={STATUS_COLOR[proposal.status]} sx={{ ml: 'auto' }} />
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{proposal.description}</Typography>
          <Divider />

          <Box>
            <Typography variant="caption" color="text.secondary">
              Proposed by <code>{proposal.proposer.slice(0, 8)}…</code>
              {' · '}
              {new Date(proposal.createdAt).toLocaleDateString()}
            </Typography>
          </Box>

          <VoteTally proposal={proposal} />

          {proposal.status === 'passed' && proposal.timelockEndsAt && (
            <TimelockCountdown endsAt={proposal.timelockEndsAt} />
          )}
          {proposal.status === 'executed' && proposal.executedAt && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon fontSize="small" color="success" />
              <Typography variant="body2" color="success.main">
                Executed on {new Date(proposal.executedAt).toLocaleDateString()}
              </Typography>
            </Box>
          )}

          {voteError && <Alert severity="error">{voteError}</Alert>}

          {!isGovernor && (
            <Alert severity="info" icon={false}>
              Your wallet is not a governor. Proposals are read-only.
            </Alert>
          )}
          {isGovernor && hasVoted && (
            <Alert severity="success" icon={false}>You have already voted on this proposal.</Alert>
          )}
          {isGovernor && !hasVoted && !votingOpen && (
            <Alert severity="warning" icon={false}>Voting period has closed.</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Close</Button>
        {isGovernor && votingOpen && !hasVoted && (
          <>
            <Button
              variant="outline"
              onClick={() => mutation.mutate(false)}
              loading={mutation.isPending}
              disabled={mutation.isPending}
            >
              Vote Against
            </Button>
            <Button
              variant="primary"
              onClick={() => mutation.mutate(true)}
              loading={mutation.isPending}
              disabled={mutation.isPending}
            >
              Vote For
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

// ── Proposal card ─────────────────────────────────────────────────────────────

interface ProposalCardProps {
  proposal: Proposal;
  isGovernor: boolean;
  onClick: () => void;
}

function ProposalCard({ proposal, isGovernor, onClick }: ProposalCardProps) {
  const votingOpen = proposal.status === 'active' && Date.now() < proposal.votingEndsAt;

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: proposal.status === 'active' ? 'primary.main' : 'divider',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: 3 },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1 }}>
        <Typography variant="body1" fontWeight={600}>{proposal.title}</Typography>
        <Chip label={proposal.status} size="small" color={STATUS_COLOR[proposal.status]} sx={{ flexShrink: 0 }} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{
        overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', mb: 1.5,
      }}>
        {proposal.description}
      </Typography>
      <VoteTally proposal={proposal} />
      {proposal.status === 'passed' && proposal.timelockEndsAt && (
        <TimelockCountdown endsAt={proposal.timelockEndsAt} />
      )}
      <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center' }}>
        {votingOpen && (
          <Tooltip title={isGovernor ? 'Open to vote' : 'Read-only (not a governor)'}>
            <Chip
              icon={<HowToVoteIcon />}
              label={isGovernor ? 'Vote now' : 'View'}
              size="small"
              color={isGovernor ? 'primary' : 'default'}
              variant="outlined"
            />
          </Tooltip>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {new Date(proposal.createdAt).toLocaleDateString()}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GovernancePage() {
  const { activeAddress } = useWallet();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Proposal | null>(null);
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>('all');

  const { data: proposals = [], isLoading, error } = useQuery({
    queryKey: queryKeys.governance.proposals(),
    queryFn: fetchProposals,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: governors = [] } = useQuery({
    queryKey: queryKeys.governance.governors(),
    queryFn: fetchGovernors,
    staleTime: 5 * 60_000,
  });

  const isGovernor = Boolean(activeAddress && governors.includes(activeAddress));

  const filtered = statusFilter === 'all'
    ? proposals
    : proposals.filter((p) => p.status === statusFilter);

  const STATUS_TABS: Array<{ label: string; value: ProposalStatus | 'all' }> = [
    { label: 'All', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Passed', value: 'passed' },
    { label: 'Executed', value: 'executed' },
    { label: 'Expired / Rejected', value: 'expired' },
  ];

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
            Your wallet (<code>{activeAddress.slice(0, 8)}…</code>) is not a governor. Proposals are read-only.
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
          onVoted={(updated) => {
            setSelected(updated);
            qc.invalidateQueries({ queryKey: queryKeys.governance.proposals() });
          }}
        />
      )}
    </AppLayout>
  );
}
