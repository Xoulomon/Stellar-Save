import React from 'react';
import { Box, Paper, Typography, Skeleton } from '@mui/material';
import type { DashboardGroup } from '../../types/dashboard';

interface DashboardChartProps {
  groups: DashboardGroup[];
  isLoading?: boolean;
}

export const DashboardChart: React.FC<DashboardChartProps> = ({ groups, isLoading }) => {
  if (isLoading) {
    return (
      <Paper sx={{ p: 3, mb: 3 }} elevation={1}>
        <Skeleton variant="text" width="30%" height={28} />
        <Skeleton variant="rectangular" height={160} sx={{ mt: 2 }} />
      </Paper>
    );
  }

  const activeGroups = groups.filter((g) => g.status === 'active');
  const completedGroups = groups.filter((g) => g.status === 'completed');

  return (
    <Paper sx={{ p: 3, mb: 3 }} elevation={1}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Savings & Cycle Overview
      </Typography>
      <Box sx={{ display: 'flex', gap: 4, alignItems: 'center', mt: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Active Groups</Typography>
          <Typography variant="h4" fontWeight="bold" color="success.main">
            {activeGroups.length}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Completed Cycles</Typography>
          <Typography variant="h4" fontWeight="bold" color="info.main">
            {completedGroups.length}
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">Total Subscribed Groups</Typography>
          <Typography variant="h4" fontWeight="bold">
            {groups.length}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};
