import HowToRegIcon from '@mui/icons-material/HowToReg';
import { Alert, Box, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { useState } from 'react';

import { Button } from '../Button';
import {
  useApproveRecoveryMutation,
  useIncomingRecoveryQuery,
} from '../../hooks/useRecoveryQueries';
import { AppCard } from '../../ui';
import { RecoveryRequestCard } from './RecoveryRequestCard';

import type { RecoveryRequest } from '../../utils/recoveryApi';

export interface GuardianApprovalsPanelProps {
  guardianAddress: string;
}

/** Incoming recovery requests awaiting this guardian's approval. */
export function GuardianApprovalsPanel({ guardianAddress }: GuardianApprovalsPanelProps) {
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useIncomingRecoveryQuery(guardianAddress);
  const approveMutation = useApproveRecoveryMutation(guardianAddress);
  const { mutateAsync, reset } = approveMutation;

  const pendingRequests = requests.filter(
    (r) => r.status === 'pending' && Date.now() < r.expiresAt
  );

  async function handleApprove(request: RecoveryRequest) {
    setApprovingId(request.id);
    reset();
    try {
      await mutateAsync(request.id);
    } catch {
      // Surfaced through `approveMutation.error` below.
    } finally {
      setApprovingId(null);
    }
  }

  const hasAlreadyApproved = (r: RecoveryRequest) => r.approvals.includes(guardianAddress);

  return (
    <AppCard>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <HowToRegIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          Incoming Recovery Requests
        </Typography>
        {pendingRequests.length > 0 && (
          <Chip label={pendingRequests.length} size="small" color="warning" sx={{ ml: 'auto' }} />
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        These recovery requests need your approval as a guardian. Review each one carefully before
        approving.
      </Typography>

      {isLoading && <LinearProgress />}
      {approveMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(approveMutation.error as Error).message}
        </Alert>
      )}

      {!isLoading && pendingRequests.length === 0 && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 2, textAlign: 'center', fontStyle: 'italic' }}
        >
          No pending recovery requests for your address.
        </Typography>
      )}

      <Stack spacing={2}>
        {pendingRequests.map((request) => {
          const alreadyApproved = hasAlreadyApproved(request);
          return (
            <Box key={request.id}>
              <RecoveryRequestCard request={request} />
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                {alreadyApproved ? (
                  <Chip icon={<HowToRegIcon />} label="You approved" size="small" color="success" />
                ) : (
                  <Button
                    variant="primary"
                    onClick={() => handleApprove(request)}
                    disabled={approvingId !== null}
                    loading={approvingId === request.id}
                  >
                    Approve Recovery
                  </Button>
                )}
              </Box>
            </Box>
          );
        })}
      </Stack>
    </AppCard>
  );
}
