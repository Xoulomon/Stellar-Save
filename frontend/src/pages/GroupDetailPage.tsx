/**
 * GroupDetail page — Issue #770
 *
 * Dedicated page for a single group at route /groups/:groupId showing:
 * - Group overview (name, status, description, progress)
 * - Member list with contribution status indicators (paid/unpaid) per cycle
 * - Payout rotation timeline with past and future recipients
 * - Contribution flow for active members
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  Typography,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { AppCard, AppLayout } from '../ui';
import { Button } from '../components/Button';
import { ContributionFlow } from '../components/ContributionFlow';
import { InsurancePanel } from '../components/InsurancePanel';
import { GroupReportExportButton } from '../components/GroupReportExportButton';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import { useNavigation } from '../routing/useNavigation';
import { useWallet } from '../hooks/useWallet';
import { useGroup } from '../hooks/useGroup';
import { queryKeys } from '../lib/queryKeys';
import type { DetailedGroup, GroupMember } from '../utils/groupApi';
import type { PayoutEntry } from '../types/contribution';

// ── Types ─────────────────────────────────────────────────────────────────────

interface MemberCycleStatus {
  memberId: string;
  memberName: string;
  address: string;
  cycleStatuses: Record<number, 'paid' | 'unpaid' | 'pending'>;
  totalContributions: number;
  isActive: boolean;
}

/** Build per-member contribution status for each cycle */
function buildMemberCycleStatuses(group: DetailedGroup): MemberCycleStatus[] {
  return group.members.map((member) => {
    const cycleStatuses: Record<number, 'paid' | 'unpaid' | 'pending'> = {};
    group.cycles.forEach((cycle) => {
      const contribution = group.contributions.find(
        (c) => c.memberId === member.id &&
          new Date(c.timestamp) >= cycle.startDate &&
          new Date(c.timestamp) <= cycle.endDate,
      );
      if (!contribution) {
        cycleStatuses[cycle.cycleNumber] = cycle.status === 'completed' ? 'unpaid' : 'pending';
      } else if (contribution.status === 'completed') {
        cycleStatuses[cycle.cycleNumber] = 'paid';
      } else {
        cycleStatuses[cycle.cycleNumber] = 'pending';
      }
    });
    return {
      memberId: member.id,
      memberName: member.name ?? 'Anonymous',
      address: member.address,
      cycleStatuses,
      totalContributions: member.totalContributions,
      isActive: member.isActive,
    };
  });
}

/** Build payout rotation entries */
function buildPayoutRotation(group: DetailedGroup): PayoutEntry[] {
  const payoutAmount = group.contributionAmount * group.totalMembers;
  return group.members.map((member, index) => {
    const cycleNum = index + 1;
    const isPast = cycleNum < (group.currentCycle?.cycleNumber ?? 1);
    const isNext = cycleNum === (group.currentCycle?.cycleNumber ?? 1);
    return {
      position: cycleNum,
      memberAddress: member.address,
      memberName: member.name ?? 'Anonymous',
      estimatedDate: new Date(group.createdAt.getTime() + cycleNum * 30 * 86400000),
      amount: payoutAmount,
      status: isPast ? 'completed' : isNext ? 'next' : 'upcoming',
      txHash: isPast ? `tx_payout_${cycleNum}` : undefined,
      paidAt: isPast ? new Date(group.createdAt.getTime() + cycleNum * 30 * 86400000) : undefined,
    };
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Status icon for paid/unpaid/pending */
function ContributionStatusIcon({ status }: { status: 'paid' | 'unpaid' | 'pending' }) {
  if (status === 'paid') {
    return (
      <Tooltip title="Paid">
        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
      </Tooltip>
    );
  }
  if (status === 'unpaid') {
    return (
      <Tooltip title="Missed">
        <CancelIcon sx={{ color: 'error.main', fontSize: 20 }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Pending">
      <AccessTimeIcon sx={{ color: 'warning.main', fontSize: 20 }} />
    </Tooltip>
  );
}

/** Member contribution status table per cycle */
function MemberContributionTable({ statuses, cycles }: {
  statuses: MemberCycleStatus[];
  cycles: DetailedGroup['cycles'];
}) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700 }}>Member</TableCell>
            {cycles.map((c) => (
              <TableCell key={c.cycleNumber} align="center" sx={{ fontWeight: 700 }}>
                Cycle {c.cycleNumber}
                <Chip
                  label={c.status}
                  size="small"
                  color={c.status === 'completed' ? 'success' : c.status === 'active' ? 'primary' : 'default'}
                  sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }}
                />
              </TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {statuses.map((s) => (
            <TableRow key={s.memberId} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: 'primary.main' }}>
                    {s.memberName.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{s.memberName}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {s.address.slice(0, 6)}…{s.address.slice(-4)}
                    </Typography>
                  </Box>
                  {!s.isActive && (
                    <Chip label="Inactive" size="small" color="default" sx={{ height: 18, fontSize: '0.65rem' }} />
                  )}
                </Box>
              </TableCell>
              {cycles.map((c) => (
                <TableCell key={c.cycleNumber} align="center">
                  <ContributionStatusIcon status={s.cycleStatuses[c.cycleNumber] ?? 'pending'} />
                </TableCell>
              ))}
              <TableCell align="right">
                <Typography variant="body2" fontWeight={600} color="primary">
                  {s.totalContributions} XLM
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Payout rotation timeline */
function PayoutRotationTimeline({ entries }: { entries: PayoutEntry[] }) {
  return (
    <Stack spacing={1.5}>
      {entries.map((entry) => {
        const isCompleted = entry.status === 'completed';
        const isNext = entry.status === 'next';
        return (
          <Box
            key={entry.position}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              borderRadius: 2,
              border: '1px solid',
              borderColor: isNext ? 'primary.main' : isCompleted ? 'success.light' : 'divider',
              bgcolor: isNext ? 'primary.50' : isCompleted ? 'success.50' : 'background.paper',
              opacity: isCompleted ? 0.75 : 1,
            }}
          >
            {/* Position badge */}
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: isNext ? 'primary.main' : isCompleted ? 'success.main' : 'action.hover',
                color: isNext || isCompleted ? 'white' : 'text.secondary',
                fontWeight: 700,
                fontSize: '0.85rem',
                flexShrink: 0,
              }}
            >
              {isCompleted ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : entry.position}
            </Box>

            {/* Member info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {entry.memberName}
                </Typography>
                {isNext && (
                  <Chip label="Next Payout" size="small" color="primary" icon={<EmojiEventsIcon />} sx={{ height: 20, fontSize: '0.65rem' }} />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                {isCompleted && entry.paidAt
                  ? `Paid on ${entry.paidAt.toLocaleDateString()}`
                  : `Est. ${entry.estimatedDate.toLocaleDateString()}`}
              </Typography>
            </Box>

            {/* Amount */}
            <Typography variant="body2" fontWeight={700} color={isNext ? 'primary.main' : 'text.primary'}>
              {entry.amount} XLM
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function GroupDetailPage() {
  return (
    <ErrorBoundary>
      <GroupDetailContent />
    </ErrorBoundary>
  );
}

function GroupDetailContent() {
  const { params } = useNavigation();
  const { activeAddress } = useWallet();
  const queryClient = useQueryClient();
  const groupId = params.groupId ?? 'demo-group';

  // Single source of truth for group detail data — shared React Query cache
  // (queryKeys.groups.detail) also populated by GroupCard's hover-prefetch,
  // so navigating here after hovering a GroupCard reuses that cache entry
  // instead of firing a second network request.
  const { group, isLoading, error, refresh } = useGroup(groupId);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [managedMember] = useState<GroupMember | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);

  const isMember = group?.members.some((m) => m.address === activeAddress);
  const canContribute = isMember && group?.status === 'active' && group?.currentCycle?.status === 'active';

  const handleRemoveMember = (memberId: string) => {
    // Optimistically update the shared cache so every consumer of this
    // group's detail query (this page, GroupCard, etc.) reflects the
    // removal immediately, without a full refetch.
    queryClient.setQueryData<DetailedGroup | null>(
      queryKeys.groups.detail(groupId),
      (prev) => (prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : prev),
    );
    setSuccessMessage('Member removed successfully.');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  if (isLoading) {
    return (
      <AppLayout title="Group Details" subtitle="Loading..." footerText="Stellar Save">
        <AppCard><LinearProgress /></AppCard>
      </AppLayout>
    );
  }

  if (error || !group) {
    return (
      <AppLayout title="Group Details" subtitle="Error" footerText="Stellar Save">
        <AppCard>
          <Stack spacing={2}>
            <Typography variant="h2" color="error">{error ?? 'Group not found'}</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button onClick={refresh} variant="primary">Try Again</Button>
              <Button onClick={() => window.history.back()} variant="secondary">Go Back</Button>
            </Box>
          </Stack>
        </AppCard>
      </AppLayout>
    );
  }

  const memberCycleStatuses = buildMemberCycleStatuses(group);
  const payoutRotation = buildPayoutRotation(group);
  const progress = group.targetAmount > 0 ? (group.currentAmount / group.targetAmount) * 100 : 0;

  return (
    <AppLayout
      title={group.name}
      subtitle={`Group ID: ${group.id}`}
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <Stack spacing={3}>
        {successMessage && <Alert severity="success">{successMessage}</Alert>}
        {actionError && <Alert severity="error" onClose={() => setActionError(null)}>{actionError}</Alert>}

        {/* Group Overview */}
        <AppCard>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="h2">{group.name}</Typography>
              <Chip
                label={group.status}
                color={group.status === 'active' ? 'success' : 'default'}
                size="small"
              />
            </Box>
            {group.description && (
              <Typography color="text.secondary">{group.description}</Typography>
            )}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2" color="text.secondary">Progress</Typography>
                <Typography variant="body2" fontWeight={600}>{progress.toFixed(1)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4 }} />
              <Typography variant="caption" color="text.secondary">
                {group.currentAmount} / {group.targetAmount} XLM
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Chip label={`${group.totalMembers} members`} size="small" variant="outlined" />
              <Chip label={group.contributionFrequency} size="small" variant="outlined" />
              <Chip label={`${group.contributionAmount} XLM / cycle`} size="small" variant="outlined" color="primary" />
            </Box>
          </Stack>
        </AppCard>

        {/* Action Bar */}
        <AppCard>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              {!isMember && group.status === 'active' && (
                <Button
                  onClick={() => { setSuccessMessage('Join request submitted!'); setTimeout(() => setSuccessMessage(null), 4000); }}
                  variant="primary"
                >
                  Join Group
                </Button>
              )}
              {canContribute && (
                <ContributionFlow
                  defaultAmount={group.contributionAmount}
                  cycleId={group.currentCycle?.cycleNumber ?? 0}
                  walletAddress={activeAddress ?? undefined}
                  onSuccess={(txHash, amount) => {
                    setSuccessMessage(`Contributed ${amount} XLM! TX: ${txHash}`);
                    // Invalidate the shared group-detail cache so the
                    // updated currentAmount/contributions are refetched
                    // everywhere this group is displayed.
                    void queryClient.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
                  }}
                  onError={(err) => setActionError(err.message)}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="secondary">Share Group</Button>
              <GroupReportExportButton group={group} />
            </Box>
          </Box>
        </AppCard>

        {/* Member Contribution Status per Cycle */}
        <AppCard>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Member Contributions by Cycle
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Shows whether each member has paid (✓), missed (✗), or has a pending contribution for each cycle.
          </Typography>
          <MemberContributionTable statuses={memberCycleStatuses} cycles={group.cycles} />
        </AppCard>

        {/* Payout Rotation Timeline */}
        <AppCard>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Payout Rotation Timeline
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            The order in which members receive the pooled payout. Past recipients are shown in green; the next recipient is highlighted.
          </Typography>
          <PayoutRotationTimeline entries={payoutRotation} />
        </AppCard>

        {/* Insurance Pool */}
        <AppCard>
          <Typography variant="h3" sx={{ mb: 2 }}>Insurance</Typography>
          <InsurancePanel groupId={groupId} memberAddress={activeAddress ?? undefined} />
        </AppCard>
      </Stack>

      {/* Member Management Dialog */}
      <Dialog open={memberDialogOpen} onClose={() => setMemberDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Manage Member</DialogTitle>
        <DialogContent>
          {managedMember && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography fontWeight={600}>{managedMember.name ?? 'Anonymous'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {managedMember.address}
              </Typography>
              <Divider />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip label={managedMember.isActive ? 'Active' : 'Inactive'} color={managedMember.isActive ? 'success' : 'default'} size="small" />
                <Chip label={`${managedMember.totalContributions} XLM`} size="small" variant="outlined" />
              </Box>
              <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
                Removing a member is irreversible and will affect the payout schedule.
              </Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setMemberDialogOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={() => { if (managedMember) handleRemoveMember(managedMember.id); setMemberDialogOpen(false); }}>
            Remove Member
          </Button>
        </DialogActions>
      </Dialog>
    </AppLayout>
  );
}
