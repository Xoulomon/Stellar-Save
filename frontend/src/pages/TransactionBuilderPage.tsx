import { useMemo } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { AppLayout } from '../ui/layout/AppLayout';
import { TransactionBuilder } from '../components/TransactionBuilder/TransactionBuilder';
import { useWallet } from '../hooks/useWallet';

export default function TransactionBuilderPage() {
  const { activeAddress } = useWallet();

  const navItems = useMemo(() => [], []);

  return (
    <AppLayout title="Transaction Builder" subtitle="Construct complex multi-step transactions" navItems={navItems}>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Multi-Step Transaction Builder
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Chain multiple operations into a single transaction, simulate to estimate fees,
            and save as reusable templates.
          </Typography>
        </Box>

        <TransactionBuilder walletAddress={activeAddress} />
      </Container>
    </AppLayout>
  );
}
