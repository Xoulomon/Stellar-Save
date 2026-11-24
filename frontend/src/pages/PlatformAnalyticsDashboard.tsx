import {
  Box,
  Card,
  CardContent,
  Typography,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useState, useEffect, useCallback } from 'react';

import { AppLayout } from '../ui';
import { KpiCard } from './platform-analytics/KpiCard';
import { TrendChart } from './platform-analytics/TrendChart';

import type { PlatformSnapshot, TrendPoint } from './platform-analytics/types';

function getRangeStart(range: string): Date {
  const d = new Date();
  if (range === '7d') d.setDate(d.getDate() - 7);
  else if (range === '30d') d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  return d;
}

const API = '/api/v1';

// Simple client-side cache keyed by request URL
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

async function fetchCached<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data as T;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  cache.set(url, { data, ts: Date.now() });
  return data;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PlatformAnalyticsDashboard() {
  const [range, setRange] = useState('30d');
  const [metric, setMetric] = useState<keyof TrendPoint>('activeUsers');
  const [snapshot, setSnapshot] = useState<PlatformSnapshot | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = getRangeStart(range).toISOString().split('T')[0];
      const endDate = new Date().toISOString().split('T')[0];

      const [snap, trendsResp] = await Promise.all([
        fetchCached<PlatformSnapshot>(`${API}/analytics/platform`),
        fetchCached<{ trends: TrendPoint[] }>(
          `${API}/analytics/platform/trends?startDate=${startDate}&endDate=${endDate}&limit=90`
        ),
      ]);

      setSnapshot(snap);
      setTrends(trendsResp.trends ?? []);
    } catch {
      setError('Failed to load analytics. Data may be unavailable in this environment.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const fmt = (n?: number) => (n ?? 0).toLocaleString();
  const pct = (n?: number) => `${((n ?? 0) * 100).toFixed(1)}%`;

  const metricOptions: { value: keyof TrendPoint; label: string }[] = [
    { value: 'activeUsers', label: 'Daily Active Users' },
    { value: 'totalGroups', label: 'Group Formation' },
    { value: 'totalContributionAmount', label: 'Contribution Volume (XLM)' },
    { value: 'totalPayoutAmount', label: 'Payout Volume (XLM)' },
  ];

  return (
    <AppLayout title="Platform Analytics" subtitle="Stakeholder insights — refreshed daily">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Time-range selector */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={range}
            exclusive
            size="small"
            onChange={(_e, v) => v && setRange(v)}
            aria-label="time range"
          >
            {['7d', '30d', '90d'].map((r) => (
              <ToggleButton key={r} value={r}>
                {r}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {error && (
          <Typography color="warning.main" variant="body2">
            {error}
          </Typography>
        )}

        {/* KPI grid */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          <KpiCard label="Total Users" value={fmt(snapshot?.totalUsers)} loading={loading} />
          <KpiCard label="Active Users" value={fmt(snapshot?.activeUsers)} loading={loading} />
          <KpiCard label="Active Groups" value={fmt(snapshot?.activeGroups)} loading={loading} />
          <KpiCard label="Success Rate" value={pct(snapshot?.successRate)} loading={loading} />
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: 2,
          }}
        >
          <KpiCard
            label="Total Contributions"
            value={fmt(snapshot?.totalContributions)}
            loading={loading}
          />
          <KpiCard
            label="Contribution Volume"
            value={`${fmt(snapshot?.totalContributionAmount)} XLM`}
            loading={loading}
          />
          <KpiCard label="Total Payouts" value={fmt(snapshot?.totalPayouts)} loading={loading} />
          <KpiCard
            label="Payout Volume"
            value={`${fmt(snapshot?.totalPayoutAmount)} XLM`}
            loading={loading}
          />
        </Box>

        {/* Trend chart with drill-down selector */}
        <Card variant="outlined">
          <CardContent>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Typography variant="subtitle1" fontWeight="bold">
                Trend
              </Typography>
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>Metric</InputLabel>
                <Select
                  value={metric}
                  label="Metric"
                  onChange={(e) => setMetric(e.target.value as keyof TrendPoint)}
                >
                  {metricOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {loading ? (
              <Skeleton variant="rectangular" height={140} />
            ) : trends.length ? (
              <TrendChart
                data={trends}
                field={metric}
                label={metricOptions.find((o) => o.value === metric)?.label ?? metric}
                color="#6366f1"
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                No trend data available for this range.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Box>
    </AppLayout>
  );
}
