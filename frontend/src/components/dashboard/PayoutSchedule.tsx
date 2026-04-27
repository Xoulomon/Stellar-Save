import React from 'react';
import { Box, Typography, Paper, Stack, Avatar, Chip } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import { Skeleton } from '../Skeleton/Skeleton';
import type { PayoutItem } from '../../types/dashboard';

interface Props { payouts: PayoutItem[]; isLoading?: boolean; }

export const PayoutSchedule: React.FC<Props> = ({ payouts, isLoading }) => (
  <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
    <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>Payout Schedule</Typography>
    <Stack spacing={3}>
      {isLoading
        ? [1, 2, 3].map((i) => (
            <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Skeleton variant="circle" width={40} height={40} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" height={16} style={{ marginBottom: 6 }} />
                <Skeleton variant="text" width="40%" height={12} />
              </Box>
              <Skeleton variant="rect" width={70} height={22} rounded />
            </Box>
          ))
        : payouts.map((item) => (
            <Box key={item.id} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: item.status === 'upcoming' ? 'rgba(31,79,212,0.1)' : 'rgba(0,143,140,0.1)', color: item.status === 'upcoming' ? 'primary.main' : 'success.main', width: 40, height: 40 }}>
                <CalendarMonthIcon fontSize="small" />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" fontWeight="bold">{item.groupName}</Typography>
                  <Typography variant="subtitle2" fontWeight="bold" color={item.status === 'upcoming' ? 'primary.main' : 'success.main'}>
                    +{item.amount.toLocaleString()} XLM
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">{item.date}</Typography>
                  <Chip label={item.status === 'upcoming' ? 'UPCOMING' : 'RECEIVED'} size="small" color={item.status === 'upcoming' ? 'warning' : 'success'} variant="soft" sx={{ fontWeight: 'bold', fontSize: '0.6rem' }} />
                </Box>
              </Box>
            </Box>
          ))}
    </Stack>
  </Paper>
);
