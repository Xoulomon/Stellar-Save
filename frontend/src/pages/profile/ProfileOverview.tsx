import { Stack, Typography, Box, Alert, Divider } from '@mui/material';

import { UserStats } from '../../components/UserStats';

import type { UserProfile } from '../../hooks/useUserProfile';
import type { Transaction } from '../../types/transaction';

const TIMELINE_LIMIT = 20;

function getTimelineLabel(tx: Transaction, address: string): string {
  const isOutgoing = tx.from === address;
  if (tx.type === 'payment') {
    return isOutgoing ? 'Contribution sent' : 'Payout received';
  }
  return tx.type ?? 'Transaction';
}

export interface ProfileOverviewProps {
  profile: UserProfile | null;
  isLoading: boolean;
}

export function ProfileOverview({ profile, isLoading }: ProfileOverviewProps) {
  if (isLoading) {
    return <Typography color="text.secondary">Loading profile data…</Typography>;
  }

  if (!profile) {
    return <Alert severity="info">Connect your wallet to view account statistics.</Alert>;
  }

  const transactions = profile.timeline ?? [];

  return (
    <Stack spacing={3}>
      <UserStats stats={profile.stats} />

      <Box>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
            mb: 2,
          }}
        >
          <Typography variant="h3">Participation Timeline</Typography>
          <Typography color="text.secondary" variant="body2">
            Showing the latest {Math.min(transactions.length, TIMELINE_LIMIT)} events
          </Typography>
        </Box>

        {transactions.length === 0 ? (
          <Typography color="text.secondary">No savings history found yet.</Typography>
        ) : (
          <Stack spacing={2}>
            {transactions.slice(0, TIMELINE_LIMIT).map((tx) => (
              <Box
                key={tx.id}
                sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 1,
                  }}
                >
                  <Typography variant="subtitle2">
                    {getTimelineLabel(tx, profile.address)}
                  </Typography>
                  <Typography variant="subtitle2" color="text.secondary">
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ display: 'grid', gap: 1 }}>
                  <Typography>
                    Amount: <strong>{tx.amount} {tx.assetCode}</strong>
                  </Typography>
                  <Typography color="text.secondary">From: {tx.from}</Typography>
                  <Typography color="text.secondary">To: {tx.to || 'Unknown'}</Typography>
                  {tx.memo && (
                    <Typography color="text.secondary">Memo: {tx.memo}</Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
