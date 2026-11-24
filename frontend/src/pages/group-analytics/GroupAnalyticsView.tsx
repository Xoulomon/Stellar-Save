import { Box, Card, CardContent, Typography, Skeleton } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import type { CycleRate } from '../../types/analytics';

export interface GroupAnalyticsViewProps {
  groupId?: string;
  cycleRates: CycleRate[];
  onTimePercent: number | null;
  projectedCompletionDate: Date | null;
  isLoading: boolean;
}

export function GroupAnalyticsView({
  groupId,
  cycleRates,
  onTimePercent,
  projectedCompletionDate,
  isLoading,
}: GroupAnalyticsViewProps) {
  const chartData = cycleRates.map((rate) => ({
    cycle: `Cycle ${rate.cycleNumber}`,
    contributionRate: rate.rate,
  }));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold">
              On-Time Payment Rate
            </Typography>
            {isLoading || onTimePercent === null ? (
              <Skeleton width="60%" height={32} />
            ) : (
              <Typography variant="h4">{onTimePercent}%</Typography>
            )}
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold">
              Projected Completion
            </Typography>
            {isLoading ? (
              <Skeleton width="60%" height={32} />
            ) : (
              <Typography variant="h4">
                {projectedCompletionDate
                  ? projectedCompletionDate.toLocaleDateString()
                  : 'Not available'}
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            Per-Cycle Contribution Rates
          </Typography>
          <Box sx={{ height: 300 }}>
            {isLoading ? (
              <Skeleton variant="rectangular" height={300} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} aria-label={`Contribution rates for ${groupId ?? 'group'}`}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="cycle" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="contributionRate" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default GroupAnalyticsView;
