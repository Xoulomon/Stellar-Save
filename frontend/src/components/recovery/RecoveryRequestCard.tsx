import HowToRegIcon from '@mui/icons-material/HowToReg';
import { Box, Chip, LinearProgress, Tooltip, Typography } from '@mui/material';

import { shortenAddress } from './format';

import type { RecoveryRequest } from '../../utils/recoveryApi';

export interface RecoveryRequestCardProps {
  request: RecoveryRequest;
}

const STATUS_COLOR: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  executed: 'success',
  expired: 'error',
};

/** Progress summary for a single active recovery request. */
export function RecoveryRequestCard({ request }: RecoveryRequestCardProps) {
  const approvalsNeeded = request.threshold - request.approvals.length;
  const progress = Math.round((request.approvals.length / request.threshold) * 100);
  const isExpired = Date.now() > request.expiresAt;

  return (
    <Box
      sx={{
        p: 2,
        border: '1px solid',
        borderColor: request.status === 'pending' ? 'warning.main' : 'divider',
        borderRadius: 2,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" fontWeight={600}>
          Recovery to{' '}
          <code style={{ fontSize: '0.8em' }}>{shortenAddress(request.newOwnerAddress)}</code>
        </Typography>
        <Chip
          label={isExpired && request.status === 'pending' ? 'expired' : request.status}
          size="small"
          color={isExpired && request.status === 'pending' ? 'error' : STATUS_COLOR[request.status]}
        />
      </Box>

      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {request.approvals.length} of {request.threshold} approvals
          </Typography>
          {approvalsNeeded > 0 && request.status === 'pending' && !isExpired && (
            <Typography variant="caption" color="warning.main" fontWeight={600}>
              {approvalsNeeded} more needed
            </Typography>
          )}
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          color={request.status === 'executed' ? 'success' : 'warning'}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      <Typography variant="caption" color="text.secondary">
        Expires {new Date(request.expiresAt).toLocaleString()}
      </Typography>

      {request.approvals.length > 0 && (
        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {request.approvals.map((addr) => (
            <Tooltip key={addr} title={addr}>
              <Chip
                icon={<HowToRegIcon fontSize="small" />}
                label={shortenAddress(addr)}
                size="small"
                color="success"
                variant="outlined"
              />
            </Tooltip>
          ))}
        </Box>
      )}
    </Box>
  );
}
