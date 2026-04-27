import { useEffect, useState } from 'react';
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
} from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { GroupDetails } from '../components/GroupDetails';
import { Button } from '../components/Button';
import { ContributionFlow } from '../components/ContributionFlow';
import { PayoutQueue } from '../components/PayoutQueue';
import { useNavigation } from '../routing/useNavigation';
import { useWallet } from '../hooks/useWallet';
import type { DetailedGroup, GroupMember } from '../utils/groupApi';
import type { PayoutQueueData } from '../types/contribution';

// ── Mock data helpers ────────────────────────────────────────────────────────

function buildMockGroup(groupId: string): DetailedGroup {
  const now = new Date();
  const members: GroupMember[] = [
    { id: '1', address: 'GABC1234567890ABCDEF', name: 'Alice', joinedAt: new Date('2026-01-10'), totalContributions: 750, isActive: true },
    { id: '2', address: 'GDEF0987654321FEDCBA', name: 'Bob', joinedAt: new Date('2026-01-12'), totalContributions: 500, isActive: true },
    { id: '3', address: 'GXYZ1111222233334444', name: 'Carol', joinedAt: new Date('2026-01-15'), totalContributions: 250, isActive: true },
    { id: '4', address: 'GAAA5555666677778888', name: 'Dave', joinedAt: new Date('2026-02-01'), totalContributions: 250, isActive: false },
  ];

  return {
    id: groupId,
    name: 'Community Savings Circle',
    description: 'A rotating savings group for community members to pool resources and support each other financially.',
    memberCount: members.length,
    contributionAmount: 250,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-01-01'),
    totalMembers: members.length,
    targetAmount: 4000,
    currentAmount: 1750,
    contributionFrequency: 'monthly',
    members,
    contributions: [
      { id: 'c1', memberId: '1', memberName: 'Alice', amount: 250, timestamp: new Date(now.getTime() - 86400000 * 2), transactionHash: 'tx_abc123', status: 'completed' },
      { id: 'c2', memberId: '2', memberName: 'Bob', amount: 250, timestamp: new Date(now.getTime() - 86400000 * 3), transactionHash: 'tx_def456', status: 'completed' },
      { id: 'c3', memberId: '3', memberName: 'Carol', amount: 250, timestamp: new Date(now.getTime() - 86400000 * 5), transactionHash: 'tx_ghi789', status: 'completed' },
      { id: 'c4', memberId: '4', memberName: 'Dave', amount: 250, timestamp: new Date(now.getTime() - 86400000 * 7), transactionHash: 'tx_jkl012', status: 'pending' },
    ],
    cycles: [
      { cycleNumber: 1, startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), targetAmount: 1000, currentAmount: 1000, status: 'completed' },
      { cycleNumber: 2, startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28'), targetAmount: 1000, currentAmount: 750, status: 'active' },
    ],
    currentCycle: { cycleNumber: 2, startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28'), targetAmount: 1000, currentAmount: 750, status: 'active' },
  };
}

function buildMockPayoutQueue(group: DetailedGroup, currentUserAddress: string | null): PayoutQueueData {
  return {
    cycleId: group.currentCycle?.cycleNumber ?? 1,
    totalMembers: group.totalMembers,
    currentUserAddress: currentUserAddress ?? undefined,
    entries: [
      { position: 1, memberAddress: 'GABC1234567890ABCDEF', memberName: 'Alice', estimatedDate: new Date('2026-01-31'), amount: group.contributionAmount * group.totalMembers, status: 'completed', txHash: 'tx_payout1', paidAt: new Date('2026-01-31') },
      { position: 2, memberAddress: 'GDEF0987654321FEDCBA', memberName: 'Bob', estimatedDate: new Date('2026-02-28'), amount: group.contributionAmount * group.totalMembers, status: 'next' },
      { position: 3, memberAddress: 'GXYZ1111222233334444', memberName: 'Carol', estimatedDate: new Date('2026-03-31'), amount: group.contributionAmount * group.totalMembers, status: 'upcoming' },
      { position: 4, memberAddress: 'GAAA5555666677778888', memberName: 'Dave', estimatedDate: new Date('2026-04-30'), amount: group.contributionAmount * group.totalMembers, status: 'upcoming' },
    ],
  };
}

// ── Member Management Dialog ─────────────────────────────────────────────────

interface MemberManagementDialogProps {
  open: boolean;
  member: GroupMember | null;
  onClose: () => void;
  onRemove: (memberId: string) => void;
}

function MemberManagementDialog({ open, member, onClose, onRemove }: MemberManagementDialogProps) {
  if (!member) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Manage Member</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body1" fontWeight={600}>{member.name || 'Anonymous'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {member.address}
          </Typography>
          <Divider />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={member.isActive ? 'Active' : 'Inactive'} color={member.isActive ? 'success' : 'default'} size="small" />
            <Chip label={`${member.totalContributions} XLM contributed`} size="small" variant="outlined" />
          </Box>
          <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
            Removing a member is irreversible and will affect the payout schedule.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          onClick={() => { onRemove(member.id); onClose(); }}
        >
          Remove Member
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
import { usePushNotifications } from '../hooks/usePushNotifications';
import type { DetailedGroup } from '../utils/groupApi';

/**
 * Group Detail Page — Issue #441
 * Displays group info, member list, contribution history, payout schedule,
 * contribute button, member management options, and responsive design.
 */
export default function GroupDetailPage() {
  const { params } = useNavigation();
  const { activeAddress } = useWallet();
  const groupId = params.groupId ?? 'demo-group';

  const [group, setGroup] = useState<DetailedGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [managedMember, setManagedMember] = useState<GroupMember | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadGroup = () => {
    setLoading(true);
    setError(null);
    // Simulate async fetch with mock data
    setTimeout(() => {
      try {
        setGroup(buildMockGroup(groupId));
      } catch {
        setError('Failed to load group details');
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  useEffect(() => { loadGroup(); }, [groupId]);

  const isMember = group?.members.some((m) => m.address === activeAddress);
  const canContribute = isMember && group?.status === 'active' && group?.currentCycle?.status === 'active';

  const handleMemberClick = (member: GroupMember) => {
    setManagedMember(member);
    setMemberDialogOpen(true);
  };

  const handleRemoveMember = (memberId: string) => {
    setGroup((prev) =>
      prev ? { ...prev, members: prev.members.filter((m) => m.id !== memberId) } : prev
    );
    setSuccessMessage('Member removed successfully.');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleJoinGroup = () => {
    setSuccessMessage('Join request submitted! Awaiting group admin approval.');
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  if (loading) {
    return (
      <AppLayout title="Group Details" subtitle="Loading..." footerText="Stellar Save - Built for transparent, on-chain savings">
        <AppCard>
          <Stack spacing={2}>
            <Typography variant="h2">Loading group...</Typography>
            <Typography color="text.secondary">Fetching group details from the network.</Typography>
          </Stack>
        </AppCard>
      </AppLayout>
    );
  }

  if (error || !group) {
    return (
      <AppLayout title="Group Details" subtitle="Error" footerText="Stellar Save - Built for transparent, on-chain savings">
        <AppCard>
          <Stack spacing={2}>
            <Typography variant="h2" color="error">{error ?? 'Group not found'}</Typography>
            <Typography color="text.secondary">Unable to load the requested group.</Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button onClick={loadGroup} variant="primary">Try Again</Button>
              <Button onClick={() => window.history.back()} variant="secondary">Go Back</Button>
            </Box>
          </Stack>
        </AppCard>
      </AppLayout>
    );
  }

  const payoutQueue = buildMockPayoutQueue(group, activeAddress);

  return (
    <AppLayout
      title={group.name}
      subtitle={`Group ID: ${group.id}`}
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <Stack spacing={3}>
        {/* Feedback messages */}
        {successMessage && <Alert severity="success">{successMessage}</Alert>}

        {/* Action Bar */}
        <AppCard>
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
          }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              {!isMember && group.status === 'active' && (
                <Button onClick={handleJoinGroup} variant="primary" size="large">
                  Join Group
                </Button>
              )}
              {canContribute && (
                <ContributionFlow
                  defaultAmount={group.contributionAmount}
                  cycleId={group.currentCycle?.cycleNumber ?? 0}
                  walletAddress={activeAddress ?? undefined}
                  onSuccess={(txHash, amount) => setSuccessMessage(`Contributed ${amount} XLM! TX: ${txHash}`)}
                  onError={(err) => setError(err.message)}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button variant="secondary" size="medium">Share Group</Button>
              <Button variant="outline" size="medium">Export Data</Button>
            </Box>
          </Box>
        </AppCard>

        {/* Group Details (overview, cycles, members, contributions) */}
        <GroupDetails
          group={group}
          members={group.members}
          contributions={group.contributions}
          cycles={group.cycles}
          currentCycle={group.currentCycle}
          onMemberClick={handleMemberClick}
          onContributionClick={(c) => console.log('Contribution:', c)}
        />

        {/* Payout Schedule */}
        <AppCard>
          <Typography variant="h3" sx={{ mb: 2 }}>Payout Schedule</Typography>
          <PayoutQueue data={payoutQueue} maxHeight={400} />
        </AppCard>
      </Stack>

      {/* Member Management Dialog */}
      <MemberManagementDialog
        open={memberDialogOpen}
        member={managedMember}
        onClose={() => setMemberDialogOpen(false)}
        onRemove={handleRemoveMember}
      />
    </AppLayout>
  );
}
