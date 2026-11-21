import HowToVoteIcon from '@mui/icons-material/HowToVote';
import { Box, Chip, Tooltip, Typography } from '@mui/material';

import { isVotingOpen, STATUS_COLOR } from './proposalStatus';
import { TimelockCountdown } from './TimelockCountdown';
import { VoteTally } from './VoteTally';

import type { Proposal } from '../../utils/governanceApi';

export interface ProposalCardProps {
  proposal: Proposal;
  isGovernor: boolean;
  onClick: () => void;
}

/** Summary card for one proposal; clicking opens the detail dialog. */
export function ProposalCard({ proposal, isGovernor, onClick }: ProposalCardProps) {
  const votingOpen = isVotingOpen(proposal);

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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 1,
          mb: 1,
        }}
      >
        <Typography variant="body1" fontWeight={600}>
          {proposal.title}
        </Typography>
        <Chip
          label={proposal.status}
          size="small"
          color={STATUS_COLOR[proposal.status]}
          sx={{ flexShrink: 0 }}
        />
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          mb: 1.5,
        }}
      >
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
