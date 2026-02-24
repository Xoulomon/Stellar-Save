import { Stack, Typography } from '@mui/material';
import { AppCard, AppLayout } from '../ui';

/**
 * Groups page - browse all savings groups
 */
export default function GroupsPage() {
  return (
    <AppLayout
      title="Groups"
      subtitle="Browse and join savings groups"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <AppCard>
        <Stack spacing={2}>
          <Typography variant="h2">Savings Groups</Typography>
          <Typography color="text.secondary">
            Browse available savings groups and join one that fits your goals.
          </Typography>
        </Stack>
      </AppCard>
    </AppLayout>
  );
}
