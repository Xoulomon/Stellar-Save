import { Box, LinearProgress, Typography } from '@mui/material';

import type { Proposal } from '../../utils/governanceApi';

export interface VoteTallyProps {
  proposal: Proposal;
}

/** For/against split with a proportional bar. */
export function VoteTally({ proposal }: VoteTallyProps) {
  const total = proposal.votesFor + proposal.votesAgainst;
  const pct = total > 0 ? Math.round((proposal.votesFor / total) * 100) : 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="success.main">
          For: {proposal.votesFor}
        </Typography>
        <Typography variant="caption" color="error.main">
          Against: {proposal.votesAgainst}
        </Typography>
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
