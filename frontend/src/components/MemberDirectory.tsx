import type { MouseEvent, ChangeEvent } from 'react';
import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Stack,
  Typography,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Grid,
  Skeleton,
  Alert,
  Tooltip,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { Link } from 'react-router-dom';
import type { MemberProfile, MemberDirectoryFilters, MemberSortOption } from '../types/member';
import { DEFAULT_MEMBER_FILTERS } from '../types/member';
import { formatAddress } from '../utils/formatAddress';
import { formatAmount } from '../utils/formatAmount';

// ── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6', '#f97316',
];

function getAvatarColor(address: string): string {
  return AVATAR_COLORS[address.charCodeAt(0) % AVATAR_COLORS.length];
}

function getInitials(name?: string, address?: string): string {
  if (name) return name.slice(0, 2).toUpperCase();
  return address ? address.slice(0, 2).toUpperCase() : '??';
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<MemberProfile['status'], 'success' | 'default' | 'warning' | 'error'> = {
  active: 'success',
  inactive: 'default',
  pending: 'warning',
  removed: 'error',
};

// ── Ordinal helper ────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Member Card ───────────────────────────────────────────────────────────────

interface MemberCardProps {
  member: MemberProfile;
  isCurrentUser?: boolean;
  groupId?: string;
}

function MemberDirectoryCard({ member, isCurrentUser, groupId }: MemberCardProps) {
  const [copied, setCopied] = useState(false);
  const avatarColor = getAvatarColor(member.address);
  const progressPct = Math.min(100, (member.payoutPosition / Math.max(member.totalMembers, 1)) * 100);

  const handleCopy = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void navigator.clipboard.writeText(member.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cardContent = (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 3,
        border: '1px solid',
        borderColor: isCurrentUser ? 'primary.main' : 'divider',
        boxShadow: isCurrentUser ? '0 0 0 2px rgba(99,102,241,0.15)' : 1,
        overflow: 'hidden',
        transition: 'box-shadow 0.2s, transform 0.2s',
        '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' },
        cursor: groupId ? 'pointer' : 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header gradient */}
      <Box sx={{ height: 48, background: `linear-gradient(135deg, ${avatarColor}22, ${avatarColor}44)` }} />

      {/* Avatar */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: -3, mb: 1 }}>
        <Box
          sx={{
            width: 56, height: 56, borderRadius: '50%',
            bgcolor: avatarColor, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 18,
            border: '3px solid white', boxShadow: 2,
          }}
        >
          {getInitials(member.name, member.address)}
        </Box>
      </Box>

      <Stack spacing={0.5} alignItems="center" px={2} pb={1}>
        {member.name && (
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {member.name}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {formatAddress(member.address)}
          </Typography>
          <Tooltip title={copied ? 'Copied!' : 'Copy address'}>
            <Box
              component="button"
              onClick={handleCopy}
              sx={{
                background: 'none', border: 'none', cursor: 'pointer', p: 0,
                color: copied ? 'success.main' : 'text.disabled',
                display: 'flex', alignItems: 'center',
                '&:hover': { color: 'primary.main' },
              }}
              aria-label="Copy address"
            >
              {copied ? (
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </Box>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'center', mt: 0.5 }}>
          <Chip
            label={member.status.charAt(0).toUpperCase() + member.status.slice(1)}
            color={STATUS_COLORS[member.status]}
            size="small"
          />
          {isCurrentUser && <Chip label="You" color="primary" size="small" variant="outlined" />}
          {member.hasReceivedPayout && <Chip label="Paid Out" color="success" size="small" variant="outlined" />}
        </Box>
      </Stack>

      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mx: 2 }} />

      {/* Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, px: 2, py: 1.5, flexGrow: 1 }}>
        <Stack alignItems="center" spacing={0}>
          <Typography variant="subtitle2" fontWeight={700}>{member.contributionCount}</Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center">Contributions</Typography>
        </Stack>
        <Stack alignItems="center" spacing={0}>
          <Typography variant="subtitle2" fontWeight={700}>{formatAmount(member.totalContributed, { decimals: 0 })}</Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center">Total Paid</Typography>
        </Stack>
        <Stack alignItems="center" spacing={0}>
          <Typography variant="subtitle2" fontWeight={700}>{ordinal(member.payoutPosition)}</Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            {member.hasReceivedPayout ? 'Received' : `of ${member.totalMembers}`}
          </Typography>
        </Stack>
      </Box>

      {/* Payout progress bar */}
      <Box sx={{ px: 2, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Payout queue</Typography>
          <Typography variant="caption" color="text.secondary">{member.payoutPosition}/{member.totalMembers}</Typography>
        </Box>
        <Box sx={{ height: 4, bgcolor: 'action.hover', borderRadius: 2, overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%', borderRadius: 2,
              bgcolor: member.hasReceivedPayout ? 'success.main' : 'primary.main',
              width: `${progressPct}%`,
              transition: 'width 0.4s ease',
            }}
          />
        </Box>
        {member.streak !== undefined && member.streak > 1 && (
          <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
            🔥 {member.streak}-cycle streak
          </Typography>
        )}
      </Box>
    </Box>
  );

  if (groupId) {
    return (
      <Box
        component={Link}
        to={`/groups/${groupId}/members/${member.address}`}
        sx={{ textDecoration: 'none', display: 'block', height: '100%' }}
      >
        {cardContent}
      </Box>
    );
  }

  return cardContent;
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function MemberCardSkeleton() {
  return (
    <Box sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <Skeleton variant="rectangular" height={48} />
      <Stack alignItems="center" p={2} spacing={1}>
        <Skeleton variant="circular" width={56} height={56} sx={{ mt: -3 }} />
        <Skeleton width={100} height={20} />
        <Skeleton width={140} height={16} />
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, width: '100%', mt: 1 }}>
          {[0, 1, 2].map((i) => (
            <Stack key={i} alignItems="center">
              <Skeleton width={40} height={20} />
              <Skeleton width={60} height={14} />
            </Stack>
          ))}
        </Box>
      </Stack>
    </Box>
  );
}

// ── Filters bar ───────────────────────────────────────────────────────────────

interface FiltersBarProps {
  filters: MemberDirectoryFilters;
  onChange: (patch: Partial<MemberDirectoryFilters>) => void;
  totalCount: number;
  filteredCount: number;
}

function FiltersBar({ filters, onChange, totalCount, filteredCount }: FiltersBarProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      flexWrap="wrap"
    >
      {/* Search */}
      <TextField
        size="small"
        placeholder="Search by name or address…"
        value={filters.search}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange({ search: e.target.value })}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </InputAdornment>
          ),
        }}
        sx={{ minWidth: 220, flexGrow: 1 }}
        inputProps={{ 'aria-label': 'Search members' }}
      />

      {/* Status filter */}
      <FormControl size="small" sx={{ minWidth: 130 }}>
        <InputLabel id="member-status-label">Status</InputLabel>
        <Select
          labelId="member-status-label"
          label="Status"
          value={filters.status}
          onChange={(e: SelectChangeEvent) => onChange({ status: e.target.value as MemberDirectoryFilters['status'] })}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
          <MenuItem value="pending">Pending</MenuItem>
        </Select>
      </FormControl>

      {/* Payout filter */}
      <FormControl size="small" sx={{ minWidth: 150 }}>
        <InputLabel id="payout-filter-label">Payout</InputLabel>
        <Select
          labelId="payout-filter-label"
          label="Payout"
          value={filters.hasReceivedPayout}
          onChange={(e: SelectChangeEvent) => onChange({ hasReceivedPayout: e.target.value as MemberDirectoryFilters['hasReceivedPayout'] })}
        >
          <MenuItem value="all">All</MenuItem>
          <MenuItem value="yes">Received</MenuItem>
          <MenuItem value="no">Pending</MenuItem>
        </Select>
      </FormControl>

      {/* Sort */}
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel id="member-sort-label">Sort by</InputLabel>
        <Select
          labelId="member-sort-label"
          label="Sort by"
          value={filters.sort}
          onChange={(e: SelectChangeEvent) => onChange({ sort: e.target.value as MemberSortOption })}
        >
          <MenuItem value="contributions-desc">Most Contributions</MenuItem>
          <MenuItem value="contributions-asc">Fewest Contributions</MenuItem>
          <MenuItem value="join-date-desc">Newest Members</MenuItem>
          <MenuItem value="join-date-asc">Oldest Members</MenuItem>
          <MenuItem value="name-asc">Name A–Z</MenuItem>
          <MenuItem value="name-desc">Name Z–A</MenuItem>
          <MenuItem value="payout-position-asc">Payout Position ↑</MenuItem>
          <MenuItem value="payout-position-desc">Payout Position ↓</MenuItem>
        </Select>
      </FormControl>

      {/* Result count */}
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap', alignSelf: 'center' }}>
        {filteredCount === totalCount
          ? `${totalCount} member${totalCount !== 1 ? 's' : ''}`
          : `${filteredCount} of ${totalCount}`}
      </Typography>
    </Stack>
  );
}

// ── Filtering & sorting logic ─────────────────────────────────────────────────

function applyFilters(members: MemberProfile[], filters: MemberDirectoryFilters): MemberProfile[] {
  let result = members;

  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (m) =>
        m.address.toLowerCase().includes(q) ||
        m.name?.toLowerCase().includes(q),
    );
  }

  if (filters.status !== 'all') {
    result = result.filter((m) => m.status === filters.status);
  }

  if (filters.hasReceivedPayout !== 'all') {
    const want = filters.hasReceivedPayout === 'yes';
    result = result.filter((m) => m.hasReceivedPayout === want);
  }

  return result;
}

function applySort(members: MemberProfile[], sort: MemberSortOption): MemberProfile[] {
  return [...members].sort((a, b) => {
    switch (sort) {
      case 'contributions-desc': return b.contributionCount - a.contributionCount;
      case 'contributions-asc':  return a.contributionCount - b.contributionCount;
      case 'join-date-desc':     return b.joinDate.getTime() - a.joinDate.getTime();
      case 'join-date-asc':      return a.joinDate.getTime() - b.joinDate.getTime();
      case 'name-asc':           return (a.name ?? a.address).localeCompare(b.name ?? b.address);
      case 'name-desc':          return (b.name ?? b.address).localeCompare(a.name ?? a.address);
      case 'payout-position-asc':  return a.payoutPosition - b.payoutPosition;
      case 'payout-position-desc': return b.payoutPosition - a.payoutPosition;
      default: return 0;
    }
  });
}

// ── Main component ────────────────────────────────────────────────────────────

export interface MemberDirectoryProps {
  members: MemberProfile[];
  isLoading?: boolean;
  error?: string | null;
  currentUserAddress?: string;
  groupId?: string;
  title?: string;
}

export function MemberDirectory({
  members,
  isLoading = false,
  error = null,
  currentUserAddress,
  groupId,
  title = 'Member Directory',
}: MemberDirectoryProps) {
  const [filters, setFilters] = useState<MemberDirectoryFilters>(DEFAULT_MEMBER_FILTERS);

  const handleFilterChange = useCallback((patch: Partial<MemberDirectoryFilters>) => {
    setFilters((prev: MemberDirectoryFilters) => ({ ...prev, ...patch }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_MEMBER_FILTERS);
  }, []);

  const filtered = useMemo(() => applyFilters(members, filters), [members, filters]);
  const sorted = useMemo(() => applySort(filtered, filters.sort), [filtered, filters.sort]);

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.hasReceivedPayout !== 'all';

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>{title}</Typography>
        {hasActiveFilters && (
          <Box
            component="button"
            onClick={handleClearFilters}
            sx={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'primary.main', fontSize: '0.875rem', fontWeight: 500,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            Clear filters
          </Box>
        )}
      </Box>

      <FiltersBar
        filters={filters}
        onChange={handleFilterChange}
        totalCount={members.length}
        filteredCount={filtered.length}
      />

      {error && <Alert severity="error">{error}</Alert>}

      {isLoading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <MemberCardSkeleton />
            </Grid>
          ))}
        </Grid>
      ) : sorted.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center', py: 8,
            border: '1px dashed', borderColor: 'divider', borderRadius: 3,
          }}
        >
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {hasActiveFilters ? 'No members match your filters' : 'No members yet'}
          </Typography>
          {hasActiveFilters && (
            <Box
              component="button"
              onClick={handleClearFilters}
              sx={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'primary.main', fontSize: '0.875rem',
                '&:hover': { textDecoration: 'underline' },
              }}
            >
              Clear filters
            </Box>
          )}
        </Box>
      ) : (
        <Grid container spacing={2}>
          {sorted.map((member: MemberProfile) => (
            <Grid item xs={12} sm={6} md={4} key={member.address}>
              <MemberDirectoryCard
                member={member}
                isCurrentUser={member.address === currentUserAddress}
                groupId={groupId}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}

export default MemberDirectory;
