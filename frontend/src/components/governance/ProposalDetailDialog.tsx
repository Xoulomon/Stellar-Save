import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import {
  Alert,
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { Button } from '../Button';
import { useCastVoteMutation } from '../../hooks/useGovernanceQueries';
import { isVotingOpen, STATUS_COLOR } from './proposalStatus';
import { TimelockCountdown } from './TimelockCountdown';
import { VoteTally } from './VoteTally';

import type { Proposal } from '../../utils/governanceApi';

export interface ProposalDetailDialogProps {
  proposal: Proposal;
  isGovernor: boolean;
  voterAddress: string;
  onClose: () => void;
  onVoted: (updated: Proposal) => void;
}

/** Full proposal detail with the vote action for governor wallets. */
export function ProposalDetailDialog({
  proposal: initial,
  isGovernor,
  voterAddress,
  onClose,
  onVoted,
}: ProposalDetailDialogProps) {
  const [proposal, setProposal] = useState(initial);
  const [voteError, setVoteError] = useState<string | null>(null);

  const { mutate, isPending } = useCastVoteMutation();

  const hasVoted = proposal.votes.some((v) => v.voter === voterAddress);
  const votingOpen = isVotingOpen(proposal);

  function handleVote(support: boolean) {
    mutate(
      { proposalId: proposal.id, voterAddress, support },
      {
        onSuccess: (updated) => {
          setProposal(updated);
          onVoted(updated);
          setVoteError(null);
        },
        onError: (e: Error) => setVoteError(e.message),
      }
    );
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <HowToVoteIcon />
        {proposal.title}
        <Chip
          label={proposal.status}
          size="small"
          color={STATUS_COLOR[proposal.status]}
          sx={{ ml: 'auto' }}
        />
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {proposal.description}
          </Typography>
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
            <Alert severity="success" icon={false}>
              You have already voted on this proposal.
            </Alert>
          )}
          {isGovernor && !hasVoted && !votingOpen && (
            <Alert severity="warning" icon={false}>
              Voting period has closed.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Close
        </Button>
        {isGovernor && votingOpen && !hasVoted && (
          <>
            <Button
              variant="outline"
              onClick={() => handleVote(false)}
              loading={isPending}
              disabled={isPending}
            >
              Vote Against
            </Button>
            <Button
              variant="primary"
              onClick={() => handleVote(true)}
              loading={isPending}
              disabled={isPending}
            >
              Vote For
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
