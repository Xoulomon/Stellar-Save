import { Stack, Typography } from '@mui/material';
import { AppCard, AppLayout } from '../ui';

/**
 * Dashboard page - user's savings overview
 */
export default function DashboardPage() {
  return (
    <AppLayout
      title="Dashboard"
      subtitle="Your savings overview"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <AppCard>
        <Stack spacing={2}>
          <Typography variant="h2">Dashboard</Typography>
          <Typography color="text.secondary">
            View your savings groups and contributions here.
          </Typography>
        </Stack>
      </AppCard>
    </AppLayout>
  );
}
