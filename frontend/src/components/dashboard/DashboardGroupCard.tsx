import React from 'react';
import { Box, Typography, Paper, LinearProgress, Stack, Chip } from '@mui/material';
import { Skeleton } from '../Skeleton/Skeleton';
import type { DashboardGroup } from '../../types/dashboard';

interface Props { group?: DashboardGroup; isLoading?: boolean; }

export const DashboardGroupCard: React.FC<Props> = ({ group, isLoading }) => {
  if (isLoading || !group) {
    return (
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton variant="text" width={140} height={18} />
            <Skeleton variant="rect" width={60} height={22} rounded />
          </Box>
          <Skeleton variant="rect" width="100%" height={8} rounded />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Skeleton variant="text" width={100} height={14} />
            <Skeleton variant="text" width={70} height={14} />
          </Box>
        </Stack>
      </Paper>
    );
  }

  const progress = (group.currentCycle / group.totalCycles) * 100;
  const statusColor = group.status === 'active' ? 'success' : group.status === 'pending' ? 'warning' : 'default';

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', transition: 'all 0.2s', '&:hover': { borderColor: 'primary.main', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' } }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1" fontWeight="bold" noWrap sx={{ maxWidth: '60%' }}>{group.name}</Typography>
          <Chip label={group.status.toUpperCase()} size="small" color={statusColor as any} variant="soft" sx={{ fontWeight: 'bold', fontSize: '0.65rem' }} />
        </Box>
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight="bold">CONTRIBUTION PROGRESS</Typography>
            <Typography variant="caption" fontWeight="bold" color="primary">{group.currentCycle} / {group.totalCycles} Months</Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(31,79,212,0.1)', '& .MuiLinearProgress-bar': { borderRadius: 4 } }} />
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.secondary">Monthly Contribution</Typography>
          <Typography variant="body2" fontWeight="bold">{group.contributionAmount} {group.currency}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
};
