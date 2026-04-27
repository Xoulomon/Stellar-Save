import { Stack, Typography, Box } from '@mui/material';
import { AppLayout, AppCard } from '../ui';
import { Leaderboard } from '../components/Leaderboard';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useWallet } from '../hooks/useWallet';
import { Button } from '../components/Button';

export default function LeaderboardPage() {
  const { data, isLoading, error, period, setPeriod, refresh } = useLeaderboard('all-time');
  const { activeAddress } = useWallet();

  return (
    <AppLayout
      title="Leaderboard"
      subtitle="Top-performing groups and contributors"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Stack spacing={0.5}>
            <Typography variant="h4" fontWeight={700}>Leaderboard</Typography>
            <Typography variant="body2" color="text.secondary">
              Rankings based on completion rate, on-time contributions, and total volume.
            </Typography>
          </Stack>
          <Button variant="secondary" onClick={refresh} disabled={isLoading}>
            ↻ Refresh
          </Button>
        </Box>

        <AppCard sx={{ p: 0, overflow: 'hidden' }}>
          <Leaderboard
            groups={data?.groups ?? []}
            members={data?.members ?? []}
            period={period}
            isLoading={isLoading}
            error={error}
            currentUserAddress={activeAddress ?? undefined}
            onPeriodChange={setPeriod}
            generatedAt={data?.generatedAt}
          />
        </AppCard>
      </Stack>
    </AppLayout>
  );
}
