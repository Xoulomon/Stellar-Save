import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import { Button } from './Button';
import { useWallet } from '../hooks/useWallet';
import { useContract } from '../hooks/useContract';
import { useTransaction, explorerUrl } from '../hooks/useTransaction';
import type { GroupDetail } from '../types/group';

const NAME_MIN = 3;
const NAME_MAX = 50;
const DESC_MAX = 500;

interface GroupSettingsProps {
  group: GroupDetail;
  onSaved?: () => void;
}

interface FormValues {
  name: string;
  description: string;
}

interface Diff {
  field: string;
  from: string;
  to: string;
}

function computeDiff(original: FormValues, updated: FormValues): Diff[] {
  const diffs: Diff[] = [];
  if (updated.name !== original.name)
    diffs.push({ field: 'Name', from: original.name, to: updated.name });
  if (updated.description !== original.description)
    diffs.push({ field: 'Description', from: original.description, to: updated.description });
  return diffs;
}

export function GroupSettings({ group, onSaved }: GroupSettingsProps) {
  const { activeAddress } = useWallet();
  const { updateGroupMetadata } = useContract();
  const { state, txHash, error, execute, reset } = useTransaction();

  const [values, setValues] = useState<FormValues>({
    name: group.name,
    description: group.description ?? '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<FormValues>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDiff, setPendingDiff] = useState<Diff[]>([]);

  // Creator gate
  if (!activeAddress || activeAddress !== group.creator) return null;

  const validate = (): boolean => {
    const errs: Partial<FormValues> = {};
    if (!values.name.trim()) errs.name = 'Name is required.';
    else if (values.name.length < NAME_MIN) errs.name = `Name must be at least ${NAME_MIN} characters.`;
    else if (values.name.length > NAME_MAX) errs.name = `Name must be at most ${NAME_MAX} characters.`;
    if (values.description.length > DESC_MAX) errs.description = `Description must be at most ${DESC_MAX} characters.`;
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const diff = computeDiff(
      { name: group.name, description: group.description ?? '' },
      values,
    );
    if (diff.length === 0) return; // nothing changed
    setPendingDiff(diff);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmOpen(false);
    reset();
    await execute(async () => {
      const result = await updateGroupMetadata({
        groupId: BigInt(group.id),
        name: values.name,
        description: values.description,
      });
      if (result.error) throw new Error(result.error.message);
      return result.txHash!;
    });
    onSaved?.();
  };

  const isPending = state === 'pending';

  return (
    <div>
      <Typography variant="h6" gutterBottom>Group Settings</Typography>

      <form onSubmit={handleSubmit} noValidate>
        <TextField
          label="Group Name"
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          error={!!fieldErrors.name}
          helperText={fieldErrors.name ?? `${values.name.length}/${NAME_MAX}`}
          fullWidth
          margin="normal"
          disabled={isPending}
          inputProps={{ maxLength: NAME_MAX }}
        />
        <TextField
          label="Description"
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          error={!!fieldErrors.description}
          helperText={fieldErrors.description ?? `${values.description.length}/${DESC_MAX}`}
          fullWidth
          multiline
          rows={3}
          margin="normal"
          disabled={isPending}
          inputProps={{ maxLength: DESC_MAX }}
        />

        <Button
          type="submit"
          variant="primary"
          disabled={isPending}
          style={{ marginTop: 16 }}
        >
          {isPending ? <><CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />Saving…</> : 'Save Changes'}
        </Button>
      </form>

      {state === 'confirmed' && txHash && (
        <Typography variant="body2" color="success.main" sx={{ mt: 2 }}>
          Saved!{' '}
          <a href={explorerUrl(txHash)} target="_blank" rel="noopener noreferrer">
            View TX →
          </a>
        </Typography>
      )}

      {state === 'failed' && error && (
        <Typography variant="body2" color="error" sx={{ mt: 2 }}>{error}</Typography>
      )}

      {/* Diff confirmation modal */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Changes</DialogTitle>
        <DialogContent>
          {pendingDiff.map((d) => (
            <Typography key={d.field} variant="body2" sx={{ mb: 1 }}>
              <strong>{d.field}:</strong>{' '}
              <span style={{ textDecoration: 'line-through', color: '#999' }}>{d.from || '(empty)'}</span>
              {' → '}
              <span>{d.to || '(empty)'}</span>
            </Typography>
          ))}
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm}>Confirm</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
