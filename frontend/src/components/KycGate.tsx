import { Box, Typography, Alert, Button, CircularProgress, Stack } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import { useKycStatus } from '../hooks/useKyc';

export interface KycGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function KycGate({ children, fallback }: KycGateProps) {
  const { status, isLoading } = useKycStatus();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (status?.status === 'approved') {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', py: 6 }}>
      <Alert severity="info" icon={<LockIcon fontSize="inherit" />} sx={{ mb: 2 }}>
        Identity verification required
      </Alert>
      <Typography variant="body1" sx={{ mb: 2 }}>
        The fiat ramp is available only after your KYC verification is approved. This helps us comply with regulations and keep the platform secure.
      </Typography>
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography variant="caption" color="text.secondary">
          Current status:
        </Typography>
        <Typography variant="caption" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
          {status?.status ?? 'unknown'}
        </Typography>
      </Stack>
      {status?.status === 'pending' && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Your verification is in progress. You will be notified once approved.
        </Typography>
      )}
    </Box>
  );
}
