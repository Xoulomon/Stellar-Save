import { useState } from 'react';
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { AppCard, AppLayout } from '../ui';
import { Button } from '../components/Button';
import { GroupCard } from '../components/GroupCard';
import { GroupStats } from '../components/GroupStats';
import { GroupTimeline, type TimelineEvent } from '../components/GroupTimeline';
import { EmptyState } from '../components/EmptyState/EmptyState';
import { CreateGroupForm } from '../components/CreateGroupForm';
import { buildRoute } from '../routing/constants';

// Form data interface (same as in CreateGroupForm)
interface FormData {
  name: string;
  description: string;
  contributionAmount: string;
  cycleDuration: string;
  maxMembers: string;
  minMembers: string;
}

// Mock data for user's groups
const mockUserGroups = [
  {
    id: '1',
    groupName: 'Family Savings',
    memberCount: 5,
    contributionAmount: 1000,
    status: 'active' as const,
  },
  {
    id: '2',
    groupName: 'Vacation Fund',
    memberCount: 3,
    contributionAmount: 500,
    status: 'active' as const,
  },
  {
    id: '3',
    groupName: 'Emergency Fund',
    memberCount: 4,
    contributionAmount: 250,
    status: 'completed' as const,
  },
];

// Mock stats data
const mockStats = {
  totalContributed: 5250,
  totalPaidOut: 3000,
  totalExpected: 7000,
  currency: 'XLM',
};

// Mock recent activity
const mockRecentActivity: TimelineEvent[] = [
  {
    id: '1',
    type: 'contribution',
    memberAddress: 'GABC123...DEF456',
    memberName: 'Family Savings',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    amount: 100,
    status: 'completed',
  },
  {
    id: '2',
    type: 'payout',
    memberAddress: 'GXYZ789...ABC012',
    memberName: 'Emergency Fund',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    amount: 1000,
    status: 'completed',
  },
  {
    id: '3',
    type: 'member_join',
    memberAddress: 'GDEF345...GHI678',
    memberName: 'Vacation Fund',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    status: 'completed',
  },
  {
    id: '4',
    type: 'contribution',
    memberAddress: 'GMNO901...PQR234',
    memberName: 'Family Savings',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
    amount: 100,
    status: 'completed',
  },
];

/**
 * Dashboard page - user's savings overview
 */
export default function DashboardPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreateGroup = (data: FormData) => {
    // TODO: Implement actual group creation
    console.log('Creating group:', data);
    setShowCreateModal(false);
  };

  const handleViewAllGroups = () => {
    // Navigate to groups page
    window.location.href = '/groups';
  };

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Your savings overview"
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      {/* Main content */}
      {/* Quick Stats Section */}
      <Box sx={{ mb: 3 }}>
        <GroupStats
          totalContributed={mockStats.totalContributed}
          totalPaidOut={mockStats.totalPaidOut}
          totalExpected={mockStats.totalExpected}
          currency={mockStats.currency}
        />
      </Box>

      {/* Main Content Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 3,
        }}
      >
        {/* User's Groups Section */}
        <Box>
          <AppCard>
            <Stack spacing={3}>
              {/* Section Header */}
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <Typography variant="h3">Your Groups</Typography>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Add />}
                  iconPosition="left"
                  onClick={() => setShowCreateModal(true)}
                >
                  {isMobile ? 'Create' : 'Create Group'}
                </Button>
              </Box>

              {/* Groups List */}
              {mockUserGroups.length > 0 ? (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                    },
                    gap: 2,
                  }}
                >
                  {mockUserGroups.map((group) => (
                    <GroupCard
                      key={group.id}
                      groupId={group.id}
                      groupName={group.groupName}
                      memberCount={group.memberCount}
                      contributionAmount={group.contributionAmount}
                      status={group.status}
                    />
                  ))}
                </Box>
              ) : (
                <EmptyState
                  title="No groups yet"
                  description="Create your first savings group to get started"
                  actionLabel="Create Group"
                  onAction={() => setShowCreateModal(true)}
                />
              )}

              {/* View All Link */}
              {mockUserGroups.length > 0 && (
                <Box sx={{ textAlign: 'center' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleViewAllGroups}
                  >
                    View All Groups
                  </Button>
                </Box>
              )}
            </Stack>
          </AppCard>
        </Box>

        {/* Recent Activity Section */}
        <Box>
          <AppCard>
            <Box sx={{ height: { xs: 'auto', lg: 400 } }}>
              <GroupTimeline
                events={mockRecentActivity}
                maxHeight="350px"
                emptyStateMessage="No recent activity"
              />
            </Box>
          </AppCard>
        </Box>
      </Box>

      {/* Create Group Modal */}
      <Dialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create New Group</DialogTitle>
        <DialogContent>
          <CreateGroupForm
            onSubmit={handleCreateGroup}
            onCancel={() => setShowCreateModal(false)}
          />
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
