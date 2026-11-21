import FlagIcon from '@mui/icons-material/Flag';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
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
} from '@mui/material';

import { useAdminGroupsQuery, useFlagGroupMutation } from '../../hooks/useAdminQueries';

export interface GroupsTableProps {
  adminId: string;
}

/** Group moderation table with flag/unflag actions. */
export function GroupsTable({ adminId }: GroupsTableProps) {
  const { data: groups = [], isLoading } = useAdminGroupsQuery();
  const flagMutation = useFlagGroupMutation();

  if (isLoading) return <LinearProgress />;

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>Members</TableCell>
          <TableCell>Contribution</TableCell>
          <TableCell>Status</TableCell>
          <TableCell>Flags</TableCell>
          <TableCell align="right">Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {groups.map((group) => (
          <TableRow key={group.id} sx={{ bgcolor: group.flagged ? 'warning.50' : undefined }}>
            <TableCell>{group.name}</TableCell>
            <TableCell>
              {group.currentMembers} / {group.maxMembers}
            </TableCell>
            <TableCell>{group.contributionAmount.toLocaleString()} XLM</TableCell>
            <TableCell>
              <Chip
                label={group.status}
                size="small"
                color={group.status === 'active' ? 'success' : 'default'}
              />
            </TableCell>
            <TableCell>
              {group.flagged && (
                <Chip
                  icon={<WarningAmberIcon />}
                  label="Under review"
                  size="small"
                  color="warning"
                />
              )}
            </TableCell>
            <TableCell align="right">
              <Tooltip title={group.flagged ? 'Clear flag' : 'Flag for review'}>
                <IconButton
                  size="small"
                  color={group.flagged ? 'default' : 'warning'}
                  onClick={() => flagMutation.mutate({ group, flagged: !group.flagged, adminId })}
                >
                  <FlagIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
