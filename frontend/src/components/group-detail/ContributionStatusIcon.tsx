import { Tooltip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircleIcon';
import CancelIcon from '@mui/icons-material/CancelIcon';
import AccessTimeIcon from '@mui/icons-material/AccessTimeIcon';

/**
 * Per-cycle contribution status indicator.
 */
export function ContributionStatusIcon({ status }: { status: 'paid' | 'unpaid' | 'pending' }) {
  if (status === 'paid') {
    return (
      <Tooltip title="Paid">
        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
      </Tooltip>
    );
  }
  if (status === 'unpaid') {
    return (
      <Tooltip title="Missed">
        <CancelIcon sx={{ color: 'error.main', fontSize: 20 }} />
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Pending">
      <AccessTimeIcon sx={{ color: 'warning.main', fontSize: 20 }} />
    </Tooltip>
  );
}
