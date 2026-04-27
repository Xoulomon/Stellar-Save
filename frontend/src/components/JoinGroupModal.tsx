import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Box, Chip, Button, Stack, Divider,
} from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import PaidIcon from '@mui/icons-material/Paid';
import type { PublicGroup } from '../types/group';

interface Props {
  group: PublicGroup | null;
  onClose: () => void;
  onConfirm: (group: PublicGroup) => void;
}

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success', pending: 'warning', completed: 'default',
};

export const JoinGroupModal: React.FC<Props> = ({ group, onClose, onConfirm }) => {
  if (!group) return null;

  return (
    <Dialog open={Boolean(group)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight="bold">Join Group</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h6" fontWeight="bold">{group.name}</Typography>
            {group.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {group.description}
              </Typography>
            )}
          </Box>
          <Divider />
          <Stack direction="row" spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <GroupsIcon fontSize="small" color="action" />
              <Typography variant="body2">{group.memberCount} members</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PaidIcon fontSize="small" color="action" />
              <Typography variant="body2">{group.contributionAmount} {group.currency}/cycle</Typography>
            </Box>
            <Chip
              label={group.status}
              size="small"
              color={STATUS_COLOR[group.status] ?? 'default'}
              variant="soft"
              sx={{ fontWeight: 'bold', fontSize: '0.65rem' }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            By joining, you commit to contributing <strong>{group.contributionAmount} {group.currency}</strong> each cycle until the group completes.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button onClick={() => onConfirm(group)} variant="contained" sx={{ textTransform: 'none', fontWeight: 'bold' }}>
          Confirm Join
        </Button>
      </DialogActions>
    </Dialog>
  );
};
