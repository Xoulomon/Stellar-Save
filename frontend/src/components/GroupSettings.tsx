import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useState } from 'react';

import { Button } from './Button';
import { useContract } from '../hooks/useContract';
import { useTransaction, explorerUrl } from '../hooks/useTransaction';
import { useWallet } from '../hooks/useWallet';

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

// See src/components/FORMS.md for the react-hook-form conventions used here.
export function GroupSettings({ group, onSaved }: GroupSettingsProps) {
  const { activeAddress } = useWallet();
  const { updateGroupMetadata } = useContract();
  const { state, txHash, error, execute, reset } = useTransaction();

  const defaultValues: FormValues = {
    name: group.name,
    description: group.description ?? '',
  };

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues, mode: 'onSubmit' });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDiff, setPendingDiff] = useState<Diff[]>([]);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);

  const nameValue = watch('name');
  const descriptionValue = watch('description');

  // Creator gate
  if (!activeAddress || activeAddress !== group.creator) return null;

  const onValid = (values: FormValues) => {
    const diff = computeDiff({ name: group.name, description: group.description ?? '' }, values);
    if (diff.length === 0) return; // nothing changed
    setPendingDiff(diff);
    setPendingValues(values);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!pendingValues) return;
    setConfirmOpen(false);
    reset();
    await execute(async () => {
      const result = await updateGroupMetadata({
        groupId: BigInt(group.id),
        name: pendingValues.name,
        description: pendingValues.description,
      });
      if (result.error) throw new Error(result.error.message);
      return result.txHash!;
    });
    onSaved?.();
  };

  const isPending = state === 'pending';

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        Group Settings
      </Typography>

      <form onSubmit={handleSubmit(onValid)} noValidate>
        <TextField
          label="Group Name"
          {...register('name', {
            validate: (value) => {
              if (!value.trim()) return 'Name is required.';
              if (value.length < NAME_MIN) return `Name must be at least ${NAME_MIN} characters.`;
              if (value.length > NAME_MAX) return `Name must be at most ${NAME_MAX} characters.`;
              return true;
            },
          })}
          error={!!errors.name}
          helperText={errors.name?.message ?? `${nameValue.length}/${NAME_MAX}`}
          fullWidth
          margin="normal"
          disabled={isPending}
          inputProps={{ maxLength: NAME_MAX }}
        />
        <TextField
          label="Description"
          {...register('description', {
            validate: (value) =>
              value.length > DESC_MAX
                ? `Description must be at most ${DESC_MAX} characters.`
                : true,
          })}
          error={!!errors.description}
          helperText={errors.description?.message ?? `${descriptionValue.length}/${DESC_MAX}`}
          fullWidth
          multiline
          rows={3}
          margin="normal"
          disabled={isPending}
          inputProps={{ maxLength: DESC_MAX }}
        />

        <Button type="submit" variant="primary" disabled={isPending} style={{ marginTop: 16 }}>
          {isPending ? (
            <>
              <CircularProgress size={14} color="inherit" sx={{ mr: 1 }} />
              Saving…
            </>
          ) : (
            'Save Changes'
          )}
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
        <Typography variant="body2" color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}

      {/* Diff confirmation modal */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm Changes</DialogTitle>
        <DialogContent>
          {pendingDiff.map((d) => (
            <Typography key={d.field} variant="body2" sx={{ mb: 1 }}>
              <strong>{d.field}:</strong>{' '}
              <span
                style={{ textDecoration: 'line-through', color: 'var(--color-text-secondary)' }}
              >
                {d.from || '(empty)'}
              </span>
              {' → '}
              <span>{d.to || '(empty)'}</span>
            </Typography>
          ))}
        </DialogContent>
        <DialogActions>
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
