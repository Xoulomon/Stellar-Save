
import { Stack, Typography } from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { useWallet } from '../hooks/useWallet';

/**
 * Profile page - user profile and wallet information
 */
export default function ProfilePage() {
  const { activeAddress } = useWallet();

  return (
    <AppLayout
      title="Profile"
      subtitle="Your account information"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <AppCard>
        <Stack spacing={2}>
          <Typography variant="h2">Profile</Typography>
          <Typography color="text.secondary">
            Wallet Address: {activeAddress || 'Not connected'}
          </Typography>
        </Stack>
      </AppCard>
    </AppLayout>
  );
}
