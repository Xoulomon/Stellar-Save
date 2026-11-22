import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';

import { Button } from '../Button';
import { useDeleteAdminUserMutation } from '../../hooks/useAdminQueries';

import type { AdminUser } from '../../utils/adminApi';

export interface DeleteUserDialogProps {
  user: AdminUser;
  adminId: string;
  onClose: () => void;
  onDeleted: () => void;
}

/** Confirmation dialog for permanently removing a user. */
export function DeleteUserDialog({ user, adminId, onClose, onDeleted }: DeleteUserDialogProps) {
  const mutation = useDeleteAdminUserMutation();
  const { mutate, isPending, isError, error } = mutation;

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete user?</DialogTitle>
      <DialogContent>
        <Typography variant="body2">
          Permanently remove <strong>{user.name || user.address}</strong> from the platform? This
          action is logged in the audit trail.
        </Typography>
        {isError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {(error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => mutate({ userId: user.id, adminId }, { onSuccess: onDeleted })}
          loading={isPending}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
