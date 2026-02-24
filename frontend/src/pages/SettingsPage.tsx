import { Stack, Typography } from '@mui/material';
import { AppCard, AppLayout } from '../ui';

/**
 * Settings page - application settings
 */
export default function SettingsPage() {
  return (
    <AppLayout
      title="Settings"
      subtitle="Configure your preferences"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <AppCard>
        <Stack spacing={2}>
          <Typography variant="h2">Settings</Typography>
          <Typography color="text.secondary">
            Configure your application preferences here.
          </Typography>
        </Stack>
      </AppCard>
    </AppLayout>
  );
}
