import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import FlagIcon from '@mui/icons-material/Flag';
import {
  Chip,
  IconButton,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useState } from 'react';

import { useAdminUsersQuery, useUpdateAdminUserMutation } from '../../hooks/useAdminQueries';
import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../../lib/queryKeys';
import { DeleteUserDialog } from './DeleteUserDialog';

import type { AdminUser } from '../../utils/adminApi';

export interface UsersTableProps {
  adminId: string;
}

/** User moderation table with flag and delete actions. */
export function UsersTable({ adminId }: UsersTableProps) {
  const queryClient = useQueryClient();
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);

  const { data: users = [], isLoading } = useAdminUsersQuery();

  const flagMutation = useUpdateAdminUserMutation();

  if (isLoading) return <LinearProgress />;

  return (
    <>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Address</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Groups</TableCell>
            <TableCell>Joined</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} sx={{ bgcolor: user.flagged ? 'error.50' : undefined }}>
              <TableCell>
                <Tooltip title={user.address}>
                  <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.78rem' }}>
                    {user.address.slice(0, 8)}…
                  </Typography>
                </Tooltip>
              </TableCell>
              <TableCell>{user.name || '—'}</TableCell>
              <TableCell>{user.groupIds.length}</TableCell>
              <TableCell>{new Date(user.joinedAt).toLocaleDateString()}</TableCell>
              <TableCell>
                {user.flagged ? (
                  <Chip icon={<FlagIcon />} label="Flagged" size="small" color="error" />
                ) : (
                  <Chip icon={<CheckCircleIcon />} label="Active" size="small" color="success" />
                )}
              </TableCell>
              <TableCell align="right">
                <Tooltip title={user.flagged ? 'Unflag user' : 'Flag for review'}>
                  <IconButton
                    size="small"
                    onClick={() =>
                      flagMutation.mutate({ user, flagged: !user.flagged, adminId })
                    }
                    color={user.flagged ? 'default' : 'warning'}
                  >
                    <FlagIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete user">
                  <IconButton size="small" color="error" onClick={() => setDeletingUser(user)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {deletingUser && (
        <DeleteUserDialog
          user={deletingUser}
          adminId={adminId}
          onClose={() => setDeletingUser(null)}
          onDeleted={() => {
            setDeletingUser(null);
            queryClient.invalidateQueries({ queryKey: queryKeys.admin.users() });
          }}
        />
      )}
    </>
  );
}
