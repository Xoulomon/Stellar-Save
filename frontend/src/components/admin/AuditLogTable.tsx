import {
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';

import { useAuditLogsQuery } from '../../hooks/useAdminQueries';

import type { AuditLog } from '../../utils/adminApi';

/** Most recent audit entries, newest first. */
export function AuditLogTable() {
  const { data: logs = [], isLoading } = useAuditLogsQuery();

  if (isLoading) return <LinearProgress />;

  const recent = logs.slice(0, 50);

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Time</TableCell>
          <TableCell>Admin</TableCell>
          <TableCell>Action</TableCell>
          <TableCell>Target</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {recent.map((log: AuditLog) => (
          <TableRow key={log.id}>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>
              {new Date(log.timestamp).toLocaleString()}
            </TableCell>
            <TableCell>
              <Tooltip title={log.userId}>
                <Typography variant="body2" fontFamily="monospace" sx={{ fontSize: '0.78rem' }}>
                  {log.userId.slice(0, 8)}…
                </Typography>
              </Tooltip>
            </TableCell>
            <TableCell>
              <Chip label={log.action} size="small" variant="outlined" />
            </TableCell>
            <TableCell>
              {log.targetType && log.targetId
                ? `${log.targetType} ${log.targetId.slice(0, 8)}`
                : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
