import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import ShieldIcon from '@mui/icons-material/Shield';
import {
  Alert,
  Box,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';

import { Button } from '../Button';
import { useGuardianConfigQuery, useSetGuardiansMutation } from '../../hooks/useRecoveryQueries';
import { validateGuardianAddress, validateThreshold } from '../../schemas/recoverySchema';
import { AppCard } from '../../ui';
import { shortenAddress } from './format';

export interface GuardianSetupPanelProps {
  ownerAddress: string;
}

/** Add/remove guardians and set the approval threshold. */
export function GuardianSetupPanel({ ownerAddress }: GuardianSetupPanelProps) {
  const [guardians, setGuardianList] = useState<string[]>([]);
  const [threshold, setThreshold] = useState(1);
  const [newAddress, setNewAddress] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { isLoading, data: configData } = useGuardianConfigQuery(ownerAddress);

  // Seed local state once the config loads (only on first load, not on re-fetches).
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && configData) {
      setGuardianList(configData.guardians);
      setThreshold(configData.threshold);
      setSeeded(true);
    }
  }, [configData, seeded]);

  const saveMutation = useSetGuardiansMutation(ownerAddress);
  const { mutate, isPending, isError, error } = saveMutation;

  function handleSaveSuccess() {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }

  function addGuardian() {
    const message = validateGuardianAddress(newAddress, { ownerAddress, guardians });
    if (message) {
      setInputError(message);
      return;
    }
    setGuardianList((prev) => [...prev, newAddress.trim()]);
    setNewAddress('');
    setInputError(null);
  }

  function removeGuardian(addr: string) {
    setGuardianList((prev) => prev.filter((g) => g !== addr));
    if (threshold > guardians.length - 1) {
      setThreshold(Math.max(1, guardians.length - 1));
    }
  }

  function handleSave() {
    mutate(
      { guardians, threshold },
      { onSuccess: handleSaveSuccess }
    );
  }

  const thresholdError = validateThreshold(threshold, guardians.length);
  const canSave = guardians.length > 0 && !thresholdError && !isPending;

  return (
    <AppCard>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <ShieldIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          Guardian Setup
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Guardians are trusted Stellar addresses that can co-sign account recovery. Set a threshold
        of how many must approve before recovery is executed.
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
          onChange={(e) => {
            setNewAddress(e.target.value);
            setInputError(null);
          }}
          error={Boolean(inputError)}
          helperText={inputError ?? ' '}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addGuardian();
          }}
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
            <IconButton
              size="small"
              onClick={() => removeGuardian(addr)}
              aria-label="Remove guardian"
            >
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

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Guardians saved successfully.
        </Alert>
      )}
      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error as Error).message}
        </Alert>
      )}

      <Button
        variant="primary"
        onClick={handleSave}
        disabled={!canSave}
        loading={isPending}
      >
        Save Guardians
      </Button>
    </AppCard>
  );
}
