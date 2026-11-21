import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, Typography, Box, Dialog, DialogTitle, DialogContent, DialogActions, Chip, Divider, Alert, LinearProgress } from '@mui/material';

import { AppCard, AppLayout } from '../../ui';
import { Button } from '../Button';
import { ContributionFlow } from '../ContributionFlow';
import { InsurancePanel } from '../InsurancePanel';
import { GroupReportExportButton } from '../GroupReportExportButton';
import { useNavigation } from '../../routing/useNavigation';
import { useWallet } from '../../hooks/useWallet';
import { useGroup } from '../../hooks/useGroup';
import { queryKeys } from '../../lib/queryKeys';
import { buildMemberCycleStatuses, buildPayoutRotation } from './groupDetailSelectors';
import { MemberContributionTable } from './MemberContributionTable';
import { PayoutRotationTimeline } from './PayoutRotationTimeline';

import type { DetailedGroup, GroupMember } from '../../utils/groupApi';

/**
 * Group detail body: overview, member statuses, payout rotation and contributions.
 */
export function GroupDetailContent() {
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
