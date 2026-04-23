import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import { PublicGroup } from '../types/group';
import { joinGroup } from '../utils/groupApi';

interface JoinGroupModalProps {
  group: PublicGroup | null;
  open: boolean;
  onClose: () => void;
  onJoined: () => void;
}

export const JoinGroupModal: React.FC<JoinGroupModalProps> = ({
  group,
  open,
  onClose,
  onJoined,
}) => {
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!group) return null;

  const handleJoin = async () => {
    setIsJoining(true);
    setError(null);
    try {
      const result = await joinGroup(group.id);
      if (result.success) {
        onJoined();
        onClose();
      }
    } catch (err) {
      setError('Failed to join the group. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <Dialog open={open} onClose={isJoining ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle fontWeight="bold">Join Savings Group</DialogTitle>
      <DialogContent>
        <Box sx={{ py: 1 }}>
          <Typography variant="body1" gutterBottom>
            You are about to join <strong>{group.name}</strong>.
          </Typography>
          
          <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2, my: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" color="text.secondary">Contribution:</Typography>
              <Typography variant="body2" fontWeight="bold">{group.contributionAmount} {group.currency}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Current Members:</Typography>
              <Typography variant="body2" fontWeight="bold">{group.memberCount}</Typography>
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary">
            By joining, you agree to make regular contributions based on the group's cycle rules. Transactions will require your signature.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} disabled={isJoining} variant="text" color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleJoin}
          disabled={isJoining}
          variant="contained"
          sx={{ borderRadius: 2, minWidth: 100 }}
        >
          {isJoining ? <CircularProgress size={24} color="inherit" /> : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
