import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import {
  Box, Stack, Typography, Tabs, Tab,
  Skeleton, Alert, Chip, Tooltip,
} from '@mui/material';
import type { LeaderboardGroup, LeaderboardMember, TimePeriod } from '../types/leaderboard';
import { formatAddress } from '../utils/formatAddress';
import { formatAmount } from '../utils/formatAmount';

// ── Period selector ───────────────────────────────────────────────────────────

const PERIODS: { value: TimePeriod; label: string }[] = [
  { value: 'week',     label: 'This Week' },
  { value: 'month',   label: 'This Month' },
  { value: 'all-time', label: 'All Time' },
];

interface PeriodTabsProps {
  value: TimePeriod;
  onChange: (p: TimePeriod) => void;
}

export function PeriodTabs({ value, onChange }: PeriodTabsProps) {
  return (
    <Tabs
      value={value}
      onChange={(_event: SyntheticEvent, v: TimePeriod) => onChange(v)}
      aria-label="Leaderboard time period"
      sx={{ borderBottom: 1, borderColor: 'divider' }}
    >
      {PERIODS.map((p) => (
        <Tab key={p.value} value={p.value} label={p.label} />
      ))}
    </Tabs>
  );
}

// ── Rank badge ────────────────────────────────────────────────────────────────

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <Typography fontSize={22} lineHeight={1} aria-label={`Rank ${rank}`}>
        {MEDAL[rank]}
      </Typography>
    );
  }
  return (
    <Box
      sx={{
        width: 32, height: 32, borderRadius: '50%',
        bgcolor: 'action.selected',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Typography variant="caption" fontWeight={700} color="text.secondary">
        {rank}
      </Typography>
    </Box>
  );
}

// ── Trend indicator ───────────────────────────────────────────────────────────

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up')   return <Typography color="success.main" fontSize={14} aria-label="Trending up">▲</Typography>;
  if (trend === 'down') return <Typography color="error.main"   fontSize={14} aria-label="Trending down">▼</Typography>;
  return <Typography color="text.disabled" fontSize={14} aria-label="Stable">—</Typography>;
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, color = 'primary.main' }: { value: number; color?: string }) {
  return (
    <Box sx={{ height: 6, bgcolor: 'action.hover', borderRadius: 3, overflow: 'hidden', minWidth: 60 }}>
      <Box
        sx={{
          height: '100%', borderRadius: 3,
          bgcolor: color,
          width: `${Math.min(100, value)}%`,
          transition: 'width 0.4s ease',
        }}
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </Box>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#6366f1','#8b5cf6','#ec4899','#3b82f6','#14b8a6','#f97316'];

function MemberAvatar({ address, name }: { address: string; name?: string }) {
  const color = AVATAR_COLORS[address.charCodeAt(0) % AVATAR_COLORS.length];
  const initials = name ? name.slice(0, 2).toUpperCase() : address.slice(0, 2).toUpperCase();
  return (
    <Box
      sx={{
        width: 36, height: 36, borderRadius: '50%',
        bgcolor: color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13, flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {initials}
    </Box>
  );
}

// ── Group row ─────────────────────────────────────────────────────────────────

interface GroupRowProps { group: LeaderboardGroup; highlight?: boolean }

function GroupRow({ group, highlight }: GroupRowProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '48px 1fr 90px 90px 80px 36px',
        alignItems: 'center',
        gap: 1.5,
        px: 2, py: 1.5,
        borderRadius: 2,
        bgcolor: highlight ? 'primary.50' : 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
        transition: 'background 0.15s',
      }}
    >
      {/* Rank */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <RankBadge rank={group.rank} />
      </Box>

      {/* Name + meta */}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>{group.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          {group.memberCount} members · {group.completedCycles}/{group.totalCycles} cycles
        </Typography>
      </Box>

      {/* Completion rate */}
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">Completion</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ProgressBar value={group.completionRate} color={group.completionRate >= 90 ? 'success.main' : 'primary.main'} />
          <Typography variant="caption" fontWeight={600}>{group.completionRate}%</Typography>
        </Box>
      </Stack>

      {/* On-time rate */}
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">On-time</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ProgressBar value={group.onTimeRate} color="warning.main" />
          <Typography variant="caption" fontWeight={600}>{group.onTimeRate}%</Typography>
        </Box>
      </Stack>

      {/* Volume */}
      <Stack spacing={0}>
        <Typography variant="caption" color="text.secondary">Volume</Typography>
        <Typography variant="caption" fontWeight={600}>{formatAmount(group.totalVolume, { decimals: 0 })}</Typography>
      </Stack>

      {/* Trend */}
      <TrendIcon trend={group.trend} />
    </Box>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────

interface MemberRowProps { member: LeaderboardMember; highlight?: boolean }

function MemberRow({ member, highlight }: MemberRowProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '48px 40px 1fr 90px 80px 60px 36px',
        alignItems: 'center',
        gap: 1.5,
        px: 2, py: 1.5,
        borderRadius: 2,
        bgcolor: highlight ? 'primary.50' : 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
        transition: 'background 0.15s',
      }}
    >
      {/* Rank */}
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <RankBadge rank={member.rank} />
      </Box>

      {/* Avatar */}
      <MemberAvatar address={member.address} name={member.name} />

      {/* Name + address */}
      <Box sx={{ minWidth: 0 }}>
        {member.name && (
          <Typography variant="body2" fontWeight={600} noWrap>{member.name}</Typography>
        )}
        <Tooltip title={member.address}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {formatAddress(member.address)}
          </Typography>
        </Tooltip>
      </Box>

      {/* On-time rate */}
      <Stack spacing={0.5}>
        <Typography variant="caption" color="text.secondary">On-time</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ProgressBar value={member.onTimeRate} color={member.onTimeRate === 100 ? 'success.main' : 'primary.main'} />
          <Typography variant="caption" fontWeight={600}>{member.onTimeRate}%</Typography>
        </Box>
      </Stack>

      {/* Total contributed */}
      <Stack spacing={0}>
        <Typography variant="caption" color="text.secondary">Contributed</Typography>
        <Typography variant="caption" fontWeight={600}>{formatAmount(member.totalContributed, { decimals: 0 })}</Typography>
      </Stack>

      {/* Streak */}
      <Box sx={{ textAlign: 'center' }}>
        {member.streak > 0 ? (
          <Tooltip title={`${member.streak}-cycle streak`}>
            <Chip
              label={`🔥 ${member.streak}`}
              size="small"
              sx={{ fontSize: 11, height: 22 }}
            />
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.disabled">—</Typography>
        )}
      </Box>

      {/* Trend */}
      <TrendIcon trend={member.trend} />
    </Box>
  );
}

// ── Table header ──────────────────────────────────────────────────────────────

function GroupTableHeader() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '48px 1fr 90px 90px 80px 36px',
        gap: 1.5, px: 2, pb: 1,
        borderBottom: '1px solid', borderColor: 'divider',
      }}
    >
      {['#', 'Group', 'Completion', 'On-time', 'Volume', ''].map((h) => (
        <Typography key={h} variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
          {h}
        </Typography>
      ))}
    </Box>
  );
}

function MemberTableHeader() {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '48px 40px 1fr 90px 80px 60px 36px',
        gap: 1.5, px: 2, pb: 1,
        borderBottom: '1px solid', borderColor: 'divider',
      }}
    >
      {['#', '', 'Member', 'On-time', 'Contributed', 'Streak', ''].map((h, i) => (
        <Typography key={i} variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">
          {h}
        </Typography>
      ))}
    </Box>
  );
}

// ── Skeleton rows ─────────────────────────────────────────────────────────────

function SkeletonRows({ count = 5, cols = 6 }: { count?: number; cols?: number }) {
  return (
    <Stack spacing={1} px={2} py={1}>
      {Array.from({ length: count }).map((_, i) => (
        <Box key={i} sx={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 1.5, alignItems: 'center' }}>
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} height={32} sx={{ borderRadius: 1 }} />
          ))}
        </Box>
      ))}
    </Stack>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export interface LeaderboardProps {
  groups: LeaderboardGroup[];
  members: LeaderboardMember[];
  period: TimePeriod;
  isLoading?: boolean;
  error?: string | null;
  currentUserAddress?: string;
  onPeriodChange: (p: TimePeriod) => void;
  generatedAt?: Date;
}

export function Leaderboard({
  groups,
  members,
  period,
  isLoading = false,
  error = null,
  currentUserAddress,
  onPeriodChange,
  generatedAt,
}: LeaderboardProps) {
  const [tab, setTab] = useState<'groups' | 'members'>('groups');

  return (
    <Stack spacing={0}>
      {/* Period filter */}
      <PeriodTabs value={period} onChange={onPeriodChange} />

      {/* Section tabs */}
      <Box sx={{ display: 'flex', gap: 1, px: 2, pt: 2, pb: 1 }}>
        <Box
          component="button"
          onClick={() => setTab('groups')}
          sx={{
            px: 2, py: 0.75, borderRadius: 2, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.875rem',
            bgcolor: tab === 'groups' ? 'primary.main' : 'action.hover',
            color: tab === 'groups' ? 'primary.contrastText' : 'text.primary',
            transition: 'all 0.15s',
          }}
          aria-pressed={tab === 'groups'}
        >
          🏆 Top Groups
        </Box>
        <Box
          component="button"
          onClick={() => setTab('members')}
          sx={{
            px: 2, py: 0.75, borderRadius: 2, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.875rem',
            bgcolor: tab === 'members' ? 'primary.main' : 'action.hover',
            color: tab === 'members' ? 'primary.contrastText' : 'text.primary',
            transition: 'all 0.15s',
          }}
          aria-pressed={tab === 'members'}
        >
          ⭐ Top Contributors
        </Box>
      </Box>

      {error && (
        <Box px={2} pb={1}>
          <Alert severity="error">{error}</Alert>
        </Box>
      )}

      {/* Table */}
      <Box sx={{ overflowX: 'auto' }}>
        {tab === 'groups' ? (
          <Box sx={{ minWidth: 560 }}>
            <GroupTableHeader />
            {isLoading ? (
              <SkeletonRows count={5} cols={6} />
            ) : groups.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No data available</Typography>
            ) : (
              <Stack spacing={0}>
                {groups.map((g) => (
                  <GroupRow key={g.id} group={g} />
                ))}
              </Stack>
            )}
          </Box>
        ) : (
          <Box sx={{ minWidth: 620 }}>
            <MemberTableHeader />
            {isLoading ? (
              <SkeletonRows count={5} cols={7} />
            ) : members.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={4}>No data available</Typography>
            ) : (
              <Stack spacing={0}>
                {members.map((m) => (
                  <MemberRow
                    key={m.address}
                    member={m}
                    highlight={m.address === currentUserAddress}
                  />
                ))}
              </Stack>
            )}
          </Box>
        )}
      </Box>

      {/* Footer */}
      {generatedAt && !isLoading && (
        <Typography variant="caption" color="text.disabled" textAlign="right" px={2} pb={1}>
          Updated {generatedAt.toLocaleTimeString()}
        </Typography>
      )}
    </Stack>
  );
}

export default Leaderboard;
