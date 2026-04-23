import React from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Stack,
  Chip,
  Divider,
  Avatar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GroupsIcon from '@mui/icons-material/Groups';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { PublicGroup } from '../types/group';

interface GroupPreviewProps {
  group: PublicGroup | null;
  open: boolean;
  onClose: () => void;
  onJoin: (group: PublicGroup) => void;
}

export const GroupPreview: React.FC<GroupPreviewProps> = ({
  group,
  open,
  onClose,
  onJoin,
}) => {
  if (!group) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'starting_soon': return 'primary';
      case 'completed': return 'default';
      default: return 'default';
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 }, p: 0 }
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight="bold">Group Details</Typography>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Box>
        
        <Divider />

        <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto' }}>
          <Stack spacing={3}>
            <Box>
              <Chip 
                label={group.status.replace('_', ' ').toUpperCase()} 
                color={getStatusColor(group.status) as any} 
                size="small" 
                sx={{ mb: 1, fontWeight: 'bold' }}
              />
              <Typography variant="h4" fontWeight="bold" gutterBottom>{group.name}</Typography>
              <Typography variant="body1" color="text.secondary">{group.description}</Typography>
            </Box>

            <Divider />

            <Stack spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.light' }}><AccountBalanceWalletIcon /></Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>CONTRIBUTION</Typography>
                  <Typography variant="body1" fontWeight="bold">{group.contributionAmount} {group.currency}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'secondary.light' }}><GroupsIcon /></Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>MEMBERS</Typography>
                  <Typography variant="body1" fontWeight="bold">{group.memberCount} Participants</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'warning.light' }}><CalendarTodayIcon /></Avatar>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>DURATION</Typography>
                  <Typography variant="body1" fontWeight="bold">{group.duration.toUpperCase()}</Typography>
                </Box>
              </Box>
            </Stack>

            <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom fontWeight="bold">Security Info</Typography>
              <Typography variant="body2" color="text.secondary">
                This group is managed by a secure Stellar smart contract. All funds are held on-chain and payouts are executed automatically based on the consensus of the group members.
              </Typography>
            </Box>
          </Stack>
        </Box>

        <Box sx={{ p: 3, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button 
            fullWidth 
            variant="contained" 
            size="large" 
            onClick={() => onJoin(group)}
            disabled={group.status === 'completed'}
            sx={{ py: 1.5, borderRadius: 3, fontWeight: 'bold' }}
          >
            {group.status === 'completed' ? 'Group Closed' : 'Join Group'}
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};
