/**
 * RecoverySetupPage — Social recovery for Stellar Save accounts.
 *
 * Two panels in a single page:
 *  1. Guardian Setup  — add/remove guardians, set threshold, persist to contract.
 *  2. Guardian Approvals — incoming recovery requests waiting for the connected
 *     wallet's approval.
 *
 * The "Recovery Status" section lets the account owner see the progress of an
 * active recovery request (remaining approvals needed).
 */
import { useState, useEffect } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Stack,
  Typography,
  Box,
  Alert,
  Chip,
  Divider,
  TextField,
  LinearProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ShieldIcon from '@mui/icons-material/Shield';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import { AppLayout, AppCard } from '../ui';
import { Button } from '../components/Button';
import { useWallet } from '../hooks/useWallet';
import {
  fetchGuardianConfig,
  setGuardians,
  fetchIncomingRequests,
  approveRecovery,
} from '../utils/recoveryApi';
import type { RecoveryRequest } from '../utils/recoveryApi';

// ── Query keys ────────────────────────────────────────────────────────────────

const recoveryKeys = {
  config: (owner: string) => ['recovery', 'config', owner] as const,
  incoming: (guardian: string) => ['recovery', 'incoming', guardian] as const,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidStellarAddress(addr: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(addr.trim());
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Guardian Setup Panel ──────────────────────────────────────────────────────

function GuardianSetupPanel({ ownerAddress }: { ownerAddress: string }) {
  const qc = useQueryClient();
  const [guardians, setGuardianList] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(1);
  const [newAddress, setNewAddress] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { isLoading, data: configData } = useQuery({
    queryKey: recoveryKeys.config(ownerAddress),
    queryFn: () => fetchGuardianConfig(ownerAddress),
  });

  // Seed local state once the config loads (only on first load, not on re-fetches).
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && configData) {
      setGuardianList(configData.guardians);
      setThreshold(configData.threshold);
      setSeeded(true);
    }
  }, [configData, seeded]);

  const saveMutation = useMutation({
    mutationFn: () => setGuardians(ownerAddress, guardians, threshold),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recoveryKeys.config(ownerAddress) });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  function addGuardian() {
    const addr = newAddress.trim();
    if (!isValidStellarAddress(addr)) {
      setInputError('Enter a valid Stellar address (starts with G, 56 chars).');
      return;
    }
    if (addr === ownerAddress) {
      setInputError('You cannot add your own address as a guardian.');
      return;
    }
    if (guardians.includes(addr)) {
      setInputError('This address is already a guardian.');
      return;
    }
    setGuardianList((prev) => [...prev, addr]);
    setNewAddress('');
    setInputError(null);
  }

  function removeGuardian(addr: string) {
    setGuardianList((prev) => prev.filter((g) => g !== addr));
    if (threshold > guardians.length - 1) {
      setThreshold(Math.max(1, guardians.length - 1));
    }
  }

  const thresholdError =
    guardians.length > 0 && threshold > guardians.length
      ? `Threshold (${threshold}) cannot exceed number of guardians (${guardians.length}).`
      : null;

  const canSave = guardians.length > 0 && !thresholdError && !saveMutation.isPending;

  return (
    <AppCard>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ShieldIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>Guardian Setup</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Guardians are trusted Stellar addresses that can co-sign account recovery.
        Set a threshold of how many must approve before recovery is executed.
      </Typography>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Add guardian input */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="Guardian address"
          placeholder="GABC…"
          value={newAddress}
          onChange={(e) => { setNewAddress(e.target.value); setInputError(null); }}
          error={Boolean(inputError)}
          helperText={inputError ?? ' '}
          onKeyDown={(e) => { if (e.key === 'Enter') addGuardian(); }}
        />
        <Box sx={{ pt: 0.25 }}>
          <Button variant="outline" onClick={addGuardian} disabled={!newAddress.trim()}>
            <AddCircleOutlineIcon fontSize="small" sx={{ mr: 0.5 }} />
            Add
          </Button>
        </Box>
      </Box>

      {/* Guardian list */}
      {guardians.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
          No guardians configured yet. Add at least one to enable social recovery.
        </Typography>
      )}
      <Stack spacing={1} sx={{ mb: 3 }}>
        {guardians.map((addr) => (
          <Box
            key={addr}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.5,
              py: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'action.hover',
            }}
          >
            <Tooltip title={addr}>
              <Typography variant="body2" fontFamily="monospace">
                {shortenAddress(addr)}
              </Typography>
            </Tooltip>
            <IconButton size="small" onClick={() => removeGuardian(addr)} aria-label="Remove guardian">
              <DeleteIcon fontSize="small" color="error" />
            </IconButton>
          </Box>
        ))}
      </Stack>

      {/* Threshold */}
      {guardians.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
            Approvals required to execute recovery
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField
              type="number"
              size="small"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              inputProps={{ min: 1, max: guardians.length, style: { width: 64 } }}
              error={Boolean(thresholdError)}
            />
            <Typography variant="body2" color="text.secondary">
              of {guardians.length} guardian{guardians.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          {thresholdError && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              {thresholdError}
            </Typography>
          )}
        </Box>
      )}

      {saveSuccess && <Alert severity="success" sx={{ mb: 2 }}>Guardians saved successfully.</Alert>}
      {saveMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(saveMutation.error as Error).message}
        </Alert>
      )}

      <Button
        variant="primary"
        onClick={() => saveMutation.mutate()}
        disabled={!canSave}
        loading={saveMutation.isPending}
      >
        Save Guardians
      </Button>
    </AppCard>
  );
}

// ── Recovery Request Status Card ──────────────────────────────────────────────

function RecoveryRequestCard({ request }: { request: RecoveryRequest }) {
  const approvalsNeeded = request.threshold - request.approvals.length;
  const progress = Math.round((request.approvals.length / request.threshold) * 100);
  const isExpired = Date.now() > request.expiresAt;

  const statusColor: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
    pending: 'warning',
    approved: 'success',
    executed: 'success',
    expired: 'error',
  };

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
          Recovery to <code style={{ fontSize: '0.8em' }}>{shortenAddress(request.newOwnerAddress)}</code>
        </Typography>
        <Chip
          label={isExpired && request.status === 'pending' ? 'expired' : request.status}
          size="small"
          color={isExpired && request.status === 'pending' ? 'error' : statusColor[request.status]}
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

// ── Guardian Approvals Panel ──────────────────────────────────────────────────

function GuardianApprovalsPanel({ guardianAddress }: { guardianAddress: string }) {
  const qc = useQueryClient();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: recoveryKeys.incoming(guardianAddress),
    queryFn: () => fetchIncomingRequests(guardianAddress),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const pendingRequests = requests.filter(
    (r) => r.status === 'pending' && Date.now() < r.expiresAt,
  );

  async function handleApprove(request: RecoveryRequest) {
    setApprovingId(request.id);
    setApproveError(null);
    try {
      await approveRecovery(request.id, guardianAddress);
      qc.invalidateQueries({ queryKey: recoveryKeys.incoming(guardianAddress) });
    } catch (e) {
      setApproveError((e as Error).message);
    } finally {
      setApprovingId(null);
    }
  }

  const hasAlreadyApproved = (r: RecoveryRequest) => r.approvals.includes(guardianAddress);

  return (
    <AppCard>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <HowToRegIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>Incoming Recovery Requests</Typography>
        {pendingRequests.length > 0 && (
          <Chip label={pendingRequests.length} size="small" color="warning" sx={{ ml: 'auto' }} />
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        These recovery requests need your approval as a guardian.
        Review each one carefully before approving.
      </Typography>

      {isLoading && <LinearProgress />}
      {approveError && <Alert severity="error" sx={{ mb: 2 }}>{approveError}</Alert>}

      {!isLoading && pendingRequests.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center', fontStyle: 'italic' }}>
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RecoverySetupPage() {
  const { activeAddress, status } = useWallet();

  if (status !== 'connected' || !activeAddress) {
    return (
      <AppLayout title="Social Recovery" subtitle="Configure guardians and approve recovery requests" footerText="Stellar Save">
        <Alert severity="info">Connect your wallet to manage social recovery settings.</Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Social Recovery"
      subtitle="Configure guardians and approve recovery requests"
      footerText="Stellar Save"
    >
      <Stack spacing={3}>
        <Alert severity="info" icon={<ShieldIcon />}>
          Social recovery lets trusted guardians restore access to your account if you lose
          your private key. Guardians never control your funds — they only co-sign recovery.
        </Alert>

        <GuardianSetupPanel ownerAddress={activeAddress} />

        <Divider />

        <GuardianApprovalsPanel guardianAddress={activeAddress} />
      </Stack>
    </AppLayout>
  );
}
