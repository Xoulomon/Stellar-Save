import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Alert, Box, Chip, LinearProgress, Typography } from '@mui/material';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { usePlatformStatsQuery } from '../../hooks/useAdminQueries';
import { AppCard } from '../../ui';
import { buildGroupTrend, buildVolumeTrend } from './adminTrends';
import { StatCard } from './StatCard';

/**
 * PlatformOverview — health metrics strip plus the two trend charts.
 *
 * Owns the platform-stats query so the page does not.
 */
export function PlatformOverview() {
  const { data: stats, isLoading, error } = usePlatformStatsQuery();

  const volumeTrend = stats ? buildVolumeTrend(stats.totalVolume) : [];
  const groupTrend = stats ? buildGroupTrend(stats.totalGroups) : [];

  const healthOk = stats?.systemHealth === 'Healthy';
  const lastBackupAgo = stats ? Math.round((Date.now() - stats.lastBackup) / 60_000) : null;

  return (
    <>
      {error && (
        <Alert severity="error">
          Failed to load platform stats. {(error as Error).message}
        </Alert>
      )}

      <AppCard>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Platform Health
        </Typography>
        {isLoading && <LinearProgress sx={{ mb: 2 }} />}
        {stats && (
          <>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                flexWrap: 'wrap',
                mb: 2,
                alignItems: 'center',
              }}
            >
              <Chip
                icon={healthOk ? <CheckCircleIcon /> : <WarningAmberIcon />}
                label={stats.systemHealth}
                color={healthOk ? 'success' : 'error'}
              />
              {lastBackupAgo !== null && (
                <Typography variant="caption" color="text.secondary">
                  Last backup:{' '}
                  {lastBackupAgo < 60
                    ? `${lastBackupAgo}m ago`
                    : `${Math.round(lastBackupAgo / 60)}h ago`}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <StatCard label="Users" value={stats.totalUsers.toLocaleString()} />
              <StatCard label="Groups" value={stats.totalGroups.toLocaleString()} />
              <StatCard label="Transactions" value={stats.totalTransactions.toLocaleString()} />
              <StatCard
                label="Total Volume"
                value={`${stats.totalVolume.toLocaleString()} XLM`}
                color="success.main"
              />
            </Box>
          </>
        )}
      </AppCard>

      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <AppCard>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
              Daily Volume (last 7 days)
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={volumeTrend}>
                <defs>
                  <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ReTooltip />
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke="#6366f1"
                  fill="url(#volGrad)"
                  strokeWidth={2}
                  name="Volume (XLM)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </AppCard>

          <AppCard>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
              Group Growth (last 6 months)
            </Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={groupTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ReTooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="groups" fill="#10b981" name="Groups" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </AppCard>
        </Box>
      )}
    </>
  );
}
