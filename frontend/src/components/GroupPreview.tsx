import React from 'react';
import {
  Drawer, Box, Typography, Stack, Chip, Divider, Button, IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GroupsIcon from '@mui/icons-material/Groups';
import PaidIcon from '@mui/icons-material/Paid';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import type { PublicGroup } from '../types/group';

interface Props {
  group: PublicGroup | null;
  onClose: () => void;
  onJoin: (group: PublicGroup) => void;
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success', pending: 'warning', completed: 'default',
};

export const GroupPreview: React.FC<Props> = ({ group, onClose, onJoin }) => (
  <Drawer anchor="right" open={Boolean(group)} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 380 }, p: 3 } }}>
    {group && (
      <Stack spacing={3} height="100%">
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, pr: 1 }}>
            <Typography variant="h6" fontWeight="bold">{group.name}</Typography>
            <Chip label={group.status} size="small" color={STATUS_COLOR[group.status] ?? 'default'} variant="soft" sx={{ mt: 0.5, fontWeight: 'bold', fontSize: '0.65rem' }} />
          </Box>
          <IconButton onClick={onClose} size="small" aria-label="Close preview"><CloseIcon /></IconButton>
        </Box>

        <Divider />

        {/* Description */}
        {group.description && (
          <Typography variant="body2" color="text.secondary">{group.description}</Typography>
        )}

        {/* Stats */}
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupsIcon fontSize="small" color="action" />
            <Typography variant="body2"><strong>{group.memberCount}</strong> members</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PaidIcon fontSize="small" color="action" />
            <Typography variant="body2">
              <strong>{group.contributionAmount} {group.currency}</strong> per cycle
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarTodayIcon fontSize="small" color="action" />
            <Typography variant="body2">
              Created {group.createdAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Typography>
          </Box>
        </Stack>

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Action */}
        <Button
          variant="contained"
          fullWidth
          disabled={group.status === 'completed'}
          onClick={() => onJoin(group)}
          sx={{ py: 1.5, fontWeight: 'bold', textTransform: 'none', borderRadius: 2 }}
        >
          {group.status === 'completed' ? 'Group Closed' : 'Join This Group'}
        </Button>
      </Stack>
    )}
  </Drawer>
);
