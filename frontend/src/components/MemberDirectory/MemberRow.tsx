import type { MouseEvent } from 'react';
import { useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  Skeleton,
  Tooltip,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { copyToClipboard } from '../../lib/clipboard';
import type { MemberProfile } from '../../types/member';
import { formatAddress, formatAmount } from '@shared-utils/formatting';

// ── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6', '#f97316',
];

export function getAvatarColor(address: string): string {
  return AVATAR_COLORS[address.charCodeAt(0) % AVATAR_COLORS.length];
}

export function getInitials(name?: string, address?: string): string {
  if (name) return name.slice(0, 2).toUpperCase();
  return address ? address.slice(0, 2).toUpperCase() : '??';
}

// ── Status config ─────────────────────────────────────────────────────────────

export const STATUS_COLORS: Record<MemberProfile['status'], 'success' | 'default' | 'warning' | 'error'> = {
  active: 'success',
  inactive: 'default',
  pending: 'warning',
  removed: 'error',
};

// ── Ordinal helper ────────────────────────────────────────────────────────────

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Member Card / Row ─────────────────────────────────────────────────────────

export interface MemberCardProps {
  member: MemberProfile;
  isCurrentUser?: boolean;
  groupId?: string;
}

export function MemberDirectoryCard({ member, isCurrentUser, groupId }: MemberCardProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const avatarColor = getAvatarColor(member.address);
  const progressPct = Math.min(100, (member.payoutPosition / Math.max(member.totalMembers, 1)) * 100);

  const handleCopy = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void copyToClipboard(member.address);
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
          <Tooltip title={copied ? t('memberDirectory.copied') : t('memberDirectory.copyAddress')}>
            <Box
              component="button"
              onClick={handleCopy}
              sx={{
                background: 'none', border: 'none', cursor: 'pointer', p: 0,
                color: copied ? 'success.main' : 'text.disabled',
                display: 'flex', alignItems: 'center',
                '&:hover': { color: 'primary.main' },
              }}
              aria-label={t('memberDirectory.copyAddress')}
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
            label={member.status === 'active' ? t('memberDirectory.active') : member.status === 'inactive' ? t('memberDirectory.inactive') : member.status === 'pending' ? t('memberDirectory.pending') : t('memberDirectory.removed')}
            color={STATUS_COLORS[member.status]}
            size="small"
          />
          {isCurrentUser && <Chip label={t('memberDirectory.you')} color="primary" size="small" variant="outlined" />}
          {member.hasReceivedPayout && <Chip label={t('memberDirectory.paidOut')} color="success" size="small" variant="outlined" />}
        </Box>
      </Stack>

      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mx: 2 }} />

      {/* Stats */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, px: 2, py: 1.5, flexGrow: 1 }}>
        <Stack alignItems="center" spacing={0}>
          <Typography variant="subtitle2" fontWeight={700}>{member.contributionCount}</Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center">{t('memberDirectory.contributions')}</Typography>
        </Stack>
        <Stack alignItems="center" spacing={0}>
          <Typography variant="subtitle2" fontWeight={700}>{formatAmount(member.totalContributed, { decimals: 0 })}</Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center">{t('memberDirectory.totalPaid')}</Typography>
        </Stack>
        <Stack alignItems="center" spacing={0}>
          <Typography variant="subtitle2" fontWeight={700}>{ordinal(member.payoutPosition)}</Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            {member.hasReceivedPayout ? t('memberDirectory.received') : t('memberDirectory.ofMembers', { count: member.totalMembers })}
          </Typography>
        </Stack>
      </Box>

      {/* Payout progress bar */}
      <Box sx={{ px: 2, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">{t('memberDirectory.payoutQueue')}</Typography>
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
            🔥 {t('memberDirectory.cycleStreak', { count: member.streak })}
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

export function MemberCardSkeleton() {
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

export const MemberRow = MemberDirectoryCard;
