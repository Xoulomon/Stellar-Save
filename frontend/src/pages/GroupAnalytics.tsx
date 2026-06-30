import { Box, Card, CardContent, Typography, Skeleton } from '@mui/material';
import { useParams } from 'react-router-dom';
import { AppLayout } from '../ui';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useGroupAnalytics } from '../hooks/useGroupAnalytics';

export default function GroupAnalytics() {
  const { groupId } = useParams<{ groupId: string }>();
  const { stats, history, isLoading, error } = useGroupAnalytics(groupId || '');

  if (error) {
    return (
      <AppLayout title="Group Analytics" subtitle={`Analytics for group: ${groupId}`}>
        <Box sx={{ p: 3 }}>
          <Typography color="error">Error loading analytics: {error}</Typography>
        </Box>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Group Analytics" subtitle={`Analytics for group: ${groupId}`}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        
        {/* Stats Row */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold">On-Time Payment Rate</Typography>
              {isLoading ? (
                <Skeleton width="60%" height={32} />
              ) : (
                <Typography variant="h4">{stats.onTimePaymentRate}%</Typography>
              )}
            </CardContent>
          </Card>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold">Projected Completion</Typography>
              {isLoading ? (
                <Skeleton width="60%" height={32} />
              ) : (
                <Typography variant="h4">{new Date(stats.projectedCompletionDate).toLocaleDateString()}</Typography>
              )}
            </CardContent>
          </Card>
        </Box>

        {/* Bar Chart */}
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
                  <BarChart data={history}>
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
    </AppLayout>
  );
}
