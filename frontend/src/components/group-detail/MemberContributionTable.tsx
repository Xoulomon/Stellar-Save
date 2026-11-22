import { Typography, Box, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Avatar, Paper } from '@mui/material';
import type { MemberCycleStatus } from './groupDetailSelectors';
import type { DetailedGroup } from '../utils/groupApi';
import { ContributionStatusIcon } from './ContributionStatusIcon';

/**
 * Member contribution status per cycle.
 */
export function MemberContributionTable({ statuses, cycles }: {
  statuses: MemberCycleStatus[];
  cycles: DetailedGroup['cycles'];
}) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: 'action.hover' }}>
            <TableCell sx={{ fontWeight: 700 }}>Member</TableCell>
            {cycles.map((c) => (
              <TableCell key={c.cycleNumber} align="center" sx={{ fontWeight: 700 }}>
                Cycle {c.cycleNumber}
                <Chip
                  label={c.status}
                  size="small"
                  color={c.status === 'completed' ? 'success' : c.status === 'active' ? 'primary' : 'default'}
                  sx={{ ml: 0.5, height: 18, fontSize: '0.65rem' }}
                />
              </TableCell>
            ))}
            <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {statuses.map((s) => (
            <TableRow key={s.memberId} hover>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: 'primary.main' }}>
                    {s.memberName.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{s.memberName}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {s.address.slice(0, 6)}…{s.address.slice(-4)}
                    </Typography>
                  </Box>
                  {!s.isActive && (
                    <Chip label="Inactive" size="small" color="default" sx={{ height: 18, fontSize: '0.65rem' }} />
                  )}
                </Box>
              </TableCell>
              {cycles.map((c) => (
                <TableCell key={c.cycleNumber} align="center">
                  <ContributionStatusIcon status={s.cycleStatuses[c.cycleNumber] ?? 'pending'} />
                </TableCell>
              ))}
              <TableCell align="right">
                <Typography variant="body2" fontWeight={600} color="primary">
                  {s.totalContributions} XLM
                </Typography>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
