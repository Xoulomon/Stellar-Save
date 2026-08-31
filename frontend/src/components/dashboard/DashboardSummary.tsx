import React from 'react';
import { Box, Paper, Typography, Skeleton } from '@mui/material';
import type { DashboardStats } from '../../types/dashboard';

interface DashboardSummaryProps {
  stats: DashboardStats | null;
  isLoading?: boolean;
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({ stats, isLoading }) => {
  if (isLoading || !stats) {
    return (
      <Paper sx={{ p: 3, mb: 3 }} elevation={1}>
        <Skeleton variant="text" width="40%" height={32} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mt: 2 }}>
          <Skeleton variant="rectangular" height={80} />
          <Skeleton variant="rectangular" height={80} />
          <Skeleton variant="rectangular" height={80} />
        </Box>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }} elevation={1}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Account Summary
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2, mt: 1 }}>
        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">Total Savings Balance</Typography>
          <Typography variant="h5" fontWeight="bold" color="primary.main">
            {stats.totalBalance?.toLocaleString()} {stats.currency || 'XLM'}
          </Typography>
        </Box>
        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">Next Payout Amount</Typography>
          <Typography variant="h5" fontWeight="bold">
            {stats.nextPayoutAmount?.toLocaleString()} {stats.currency || 'XLM'}
          </Typography>
        </Box>
        <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">Estimated Payout Date</Typography>
          <Typography variant="h5" fontWeight="bold">
            {stats.nextPayoutDate || 'N/A'}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};
