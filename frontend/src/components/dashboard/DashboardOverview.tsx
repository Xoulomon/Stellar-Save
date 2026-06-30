import React from 'react';
import { Box, Typography, Paper, Stack, Divider } from '@mui/material';
import { Skeleton } from '../Skeleton/Skeleton';
import type { DashboardStats } from '../../types/dashboard';

interface Props { stats: DashboardStats; isLoading?: boolean; }

export const DashboardOverview: React.FC<Props> = ({ stats, isLoading }) => {
  if (isLoading) {
    return (
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, background: 'linear-gradient(135deg, #1f4fd4 0%, #173b9f 100%)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
          {[1, 2].map((i) => (
            <Box key={i} sx={{ flex: 1 }}>
              <Skeleton variant="text" width={160} height={14} style={{ marginBottom: 12, opacity: 0.35 }} />
              <Skeleton variant="text" width={220} height={42} style={{ opacity: 0.35 }} />
            </Box>
          ))}
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 4, borderRadius: 4, background: 'linear-gradient(135deg, #1f4fd4 0%, #173b9f 100%)', color: 'white', boxShadow: '0 8px 32px rgba(31,79,212,0.2)' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} divider={<Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ opacity: 0.75, mb: 1, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
            Total Account Balance
          </Typography>
          <Typography variant="h3" fontWeight="900">
            {stats.totalBalance.toLocaleString()}{' '}
            <Typography component="span" variant="h5" sx={{ opacity: 0.75 }}>{stats.currency}</Typography>
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle2" sx={{ opacity: 0.75, mb: 1, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
            Next Scheduled Payout
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={1} flexWrap="wrap">
            <Typography variant="h4" fontWeight="bold">{stats.nextPayoutAmount.toLocaleString()} {stats.currency}</Typography>
            <Typography variant="body1" sx={{ opacity: 0.75 }}>on {stats.nextPayoutDate}</Typography>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};
