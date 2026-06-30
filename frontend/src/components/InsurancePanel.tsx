/**
 * InsurancePanel — Issue #1012
 * Shows current insurance pool balance and claim history for a group.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Typography, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  LinearProgress,
} from '@mui/material';
import SecurityIcon from '@mui/icons-material/Security';
import { Button } from './Button';
import { Input } from './Input';
import { queryKeys } from '../lib/queryKeys';
import { fetchInsurancePool, fileClaim } from '../utils/insuranceApi';
import type { InsuranceClaim } from '../utils/insuranceApi';

interface InsurancePanelProps {
  groupId: string;
  memberAddress?: string;
}

const STATUS_COLORS: Record<InsuranceClaim['status'], 'default' | 'warning' | 'success' | 'error'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
};

export function InsurancePanel({ groupId, memberAddress }: InsurancePanelProps) {
  const qc = useQueryClient();
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimAmount, setClaimAmount] = useState('');
  const [claimReason, setClaimReason] = useState('');
  const [claimError, setClaimError] = useState<string | null>(null);

  const { data: pool, isLoading, error } = useQuery({
    queryKey: queryKeys.insurance.byGroup(groupId),
    queryFn: () => fetchInsurancePool(groupId),
    staleTime: 30_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      fileClaim(groupId, {
        claimant: memberAddress ?? '',
        amount: parseFloat(claimAmount),
        reason: claimReason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.insurance.byGroup(groupId) });
      setClaimOpen(false);
      setClaimAmount('');
      setClaimReason('');
      setClaimError(null);
    },
    onError: (e: Error) => setClaimError(e.message),
  });

  if (isLoading) return <LinearProgress />;
  if (error || !pool) return null;
  if (!pool.enabled) return null;

  return (
    <Box>
      {/* Balance summary */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <SecurityIcon color="primary" />
        <Box>
          <Typography variant="h6" fontWeight={700}>Insurance Pool</Typography>
          <Typography variant="body2" color="text.secondary">
            Balance: <strong>{pool.balance.toLocaleString()} XLM</strong>
            {' '}· Premium: <strong>{(pool.premiumRate * 100).toFixed(1)}%</strong> per contribution
          </Typography>
        </Box>
        {memberAddress && (
          <Button variant="outline" onClick={() => setClaimOpen(true)}>
            File a Claim
          </Button>
        )}
      </Box>

      {/* Claim history */}
      {pool.claims.length > 0 ? (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 700 }}>Claimant</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Amount</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pool.claims.map((claim) => (
                <TableRow key={claim.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>
                    {claim.claimant.slice(0, 6)}…{claim.claimant.slice(-4)}
                  </TableCell>
                  <TableCell align="right">{claim.amount} XLM</TableCell>
                  <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {claim.reason}
                  </TableCell>
                  <TableCell>
                    <Chip label={claim.status} size="small" color={STATUS_COLORS[claim.status]} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                    {new Date(claim.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No claims have been filed yet.
        </Typography>
      )}

      {/* File claim dialog */}
      <Dialog open={claimOpen} onClose={() => setClaimOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>File an Insurance Claim</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {claimError && <Alert severity="error">{claimError}</Alert>}
            <Input
              label="Amount (XLM)"
              type="number"
              value={claimAmount}
              onChange={(e) => setClaimAmount(e.target.value)}
              helperText={`Pool balance: ${pool.balance} XLM`}
            />
            <Input
              label="Reason"
              value={claimReason}
              onChange={(e) => setClaimReason(e.target.value)}
              helperText="Briefly describe why you are filing this claim."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setClaimOpen(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!claimAmount || !claimReason || mutation.isPending}
          >
            Submit Claim
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
