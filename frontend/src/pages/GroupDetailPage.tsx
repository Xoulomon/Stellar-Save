import { useEffect, useState } from 'react';
import { Stack, Typography, Box } from '@mui/material';
import { AppCard, AppLayout } from '../ui';
import { GroupDetails } from '../components/GroupDetails';
import { Button } from '../components/Button';
import ContributeButton from '../components/ContributeButton';
import { useNavigation } from '../routing/useNavigation';
import { fetchGroup } from '../utils/groupApi';
import { useWallet } from '../hooks/useWallet';
import type { DetailedGroup } from '../utils/groupApi';

/**
 * Group detail page - individual group information with actions
 */
export default function GroupDetailPage() {
  const { params } = useNavigation();
  const { activeAddress } = useWallet();
  const groupId = params.groupId;

  const [group, setGroup] = useState<DetailedGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId) {
      setError('No group ID provided');
      setLoading(false);
      return;
    }

    const loadGroup = async () => {
      try {
        setLoading(true);
        setError(null);
        const groupData = await fetchGroup(groupId);
        setGroup(groupData);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load group details';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadGroup();
  }, [groupId]);

  const handleRetry = () => {
    if (groupId) {
      setError(null);
      setLoading(true);
      fetchGroup(groupId)
        .then(setGroup)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load group details'))
        .finally(() => setLoading(false));
    }
  };

  const handleContribute = () => {
    // TODO: Implement contribution logic
    console.log('Contribute to group:', groupId);
  };

  const handleJoinGroup = () => {
    // TODO: Implement join group logic
    console.log('Join group:', groupId);
  };

  const isMember = group?.members.some(member => member.address === activeAddress);
  const canContribute = isMember && group?.status === 'active' && group?.currentCycle?.status === 'active';

  if (loading) {
    return (
      <AppLayout
        title="Group Details"
        subtitle="Loading group information..."
        footerText="Stellar Save - Built for transparent, on-chain savings"
      >
        <AppCard>
          <Stack spacing={2}>
            <Typography variant="h2">Loading...</Typography>
            <Typography color="text.secondary">
              Please wait while we fetch the group details.
            </Typography>
          </Stack>
        </AppCard>
      </AppLayout>
    );
  }

  if (error || !group) {
    return (
      <AppLayout
        title="Group Details"
        subtitle="Error loading group"
        footerText="Stellar Save - Built for transparent, on-chain savings"
      >
        <AppCard>
          <Stack spacing={2}>
            <Typography variant="h2" color="error">
              {error || 'Group not found'}
            </Typography>
            <Typography color="text.secondary">
              {error ? 'There was an error loading the group details.' : 'The requested group could not be found.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button onClick={handleRetry} variant="primary">
                Try Again
              </Button>
              <Button onClick={() => window.history.back()} variant="secondary">
                Go Back
              </Button>
            </Box>
          </Stack>
        </AppCard>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={group.name}
      subtitle={`Group ID: ${group.id}`}
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <Stack spacing={3}>
        {/* Action Buttons */}
        <AppCard>
          <Box sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between'
          }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
              {!isMember && group.status === 'active' && (
                <Button onClick={handleJoinGroup} variant="primary" size="large">
                  Join Group
                </Button>
              )}
              {canContribute && (
                <ContributeButton
                  amount={group.contributionAmount}
                  cycleId={group.currentCycle?.cycleNumber || 0}
                  walletAddress={activeAddress || undefined}
                  onSuccess={(txHash) => console.log('Contribution successful:', txHash)}
                  onError={(error) => console.error('Contribution failed:', error)}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="secondary" size="medium">
                Share Group
              </Button>
              <Button variant="outline" size="medium">
                Export Data
              </Button>
            </Box>
          </Box>
        </AppCard>

        {/* Group Details */}
        <GroupDetails
          group={group}
          members={group.members}
          contributions={group.contributions}
          cycles={group.cycles}
          currentCycle={group.currentCycle}
          onMemberClick={(member) => console.log('Member clicked:', member)}
          onContributionClick={(contribution) => console.log('Contribution clicked:', contribution)}
        />
      </Stack>
    </AppLayout>
  );
}
