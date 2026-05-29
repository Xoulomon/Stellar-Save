import { Box, Card, CardContent, LinearProgress, Skeleton, Typography } from '@mui/material';
import { AppLayout } from '../ui';
import { useAnalytics } from '../hooks/useAnalytics';
import type { ContributionDataPoint, MemberComparisonItem } from '../types/analytics';

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, isLoading }: { label: string; value: string; sub?: string; isLoading: boolean }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        {isLoading ? (
          <Skeleton width="60%" height={32} />
        ) : (
          <Typography variant="h5" fontWeight="bold">{value}</Typography>
        )}
        {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
      </CardContent>
    </Card>
  );
}

// ─── Bar chart (SVG) ──────────────────────────────────────────────────────────
function BarChart({ data }: { data: ContributionDataPoint[] }) {
  const maxVal = Math.max(...data.flatMap((d) => [d.contributed, d.received]), 1);
  const W = 480;
  const H = 160;
  const barW = Math.floor((W / data.length) * 0.35);
  const gap = Math.floor((W / data.length) * 0.1);
  const slotW = W / data.length;

  return (
    <Box sx={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H + 24}`} style={{ width: '100%', minWidth: 320 }} aria-label="Contribution history bar chart">
        {data.map((d, i) => {
          const x = i * slotW + gap;
          const hC = (d.contributed / maxVal) * H;
          const hR = (d.received / maxVal) * H;
          return (
            <g key={d.month}>
              {/* contributed bar */}
              <rect x={x} y={H - hC} width={barW} height={hC} fill="#6366f1" rx={2}>
                <title>{`${d.month} contributed: ${d.contributed} XLM`}</title>
              </rect>
              {/* received bar */}
              <rect x={x + barW + 2} y={H - hR} width={barW} height={hR} fill="#22c55e" rx={2}>
                <title>{`${d.month} received: ${d.received} XLM`}</title>
              </rect>
              {/* label */}
              <text x={x + barW} y={H + 16} textAnchor="middle" fontSize={9} fill="#94a3b8">
                {d.month.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
      <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
        <LegendDot color="#6366f1" label="Contributed" />
        <LegendDot color="#22c55e" label="Received" />
      </Box>
    </Box>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  );
}

// ─── Member comparison ────────────────────────────────────────────────────────
function MemberComparisonRow({ item }: { item: MemberComparisonItem }) {
  const isYou = item.label === 'You';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Typography
        variant="body2"
        sx={{ width: 80, flexShrink: 0, fontWeight: isYou ? 'bold' : 'normal', color: isYou ? 'primary.main' : 'text.primary' }}
      >
        {item.label}
      </Typography>
      <Box sx={{ flex: 1 }}>
        <LinearProgress
          variant="determinate"
          value={item.onTimePercent}
          sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover', '& .MuiLinearProgress-bar': { bgcolor: isYou ? 'primary.main' : 'text.disabled' } }}
        />
      </Box>
      <Typography variant="body2" sx={{ width: 44, textAlign: 'right', flexShrink: 0 }}>
        {item.onTimePercent.toFixed(0)}%
      </Typography>
    </Box>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AnalyticsDashboardPage() {
  const { stats, history, memberComparison, isLoading } = useAnalytics();

  const roiColor = stats.roi >= 0 ? 'success.main' : 'error.main';

  return (
    <AppLayout title="Analytics" subtitle="Your contribution patterns and statistics">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* Stats row */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
          <StatCard label="Total Contributed" value={`${stats.totalContributed.toLocaleString()} XLM`} isLoading={isLoading} />
          <StatCard label="Total Received" value={`${stats.totalReceived.toLocaleString()} XLM`} isLoading={isLoading} />
          <StatCard
            label="ROI"
            value={`${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`}
            sub="vs. contributed"
            isLoading={isLoading}
          />
          <StatCard label="On-Time Rate" value={`${stats.onTimePercent.toFixed(1)}%`} sub={`${stats.activeGroups} active groups`} isLoading={isLoading} />
        </Box>

        {/* ROI colour hint */}
        {!isLoading && (
          <Typography variant="body2" color={roiColor}>
            {stats.roi >= 0
              ? `You've received ${stats.roi.toFixed(1)}% more than you've contributed so far.`
              : `You've contributed ${Math.abs(stats.roi).toFixed(1)}% more than you've received — payouts are still coming.`}
          </Typography>
        )}

        {/* Contribution history chart */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
              Contribution History
            </Typography>
            {isLoading ? <Skeleton variant="rectangular" height={160} /> : <BarChart data={history} />}
          </CardContent>
        </Card>

        {/* Member comparison */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
              On-Time Rate vs. Group Members
            </Typography>
            {isLoading ? (
              [1, 2, 3, 4].map((i) => <Skeleton key={i} height={28} sx={{ mb: 1 }} />)
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {memberComparison.map((m) => (
                  <MemberComparisonRow key={m.address} item={m} />
                ))}
              </Box>
            )}
          </CardContent>
        </Card>

      </Box>
    </AppLayout>
  );
}
