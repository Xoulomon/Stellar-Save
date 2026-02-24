import {  Stack, Typography } from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { useNavigation } from '../routing/useNavigation';

/**
 * Group detail page - individual group information
 */
export default function GroupDetailPage() {
  const { params } = useNavigation();
  const groupId = params.groupId;

  return (
    <AppLayout
      title="Group Details"
      subtitle={`Group ID: ${groupId}`}
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <AppCard>
        <Stack spacing={2}>
          <Typography variant="h2">Group Details</Typography>
          <Typography color="text.secondary">
            Viewing details for group: {groupId}
          </Typography>
        </Stack>
      </AppCard>
    </AppLayout>
  );
}
