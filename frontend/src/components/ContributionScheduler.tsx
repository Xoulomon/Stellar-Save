import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
// Minimal inline SVG icons to avoid @mui/icons-material dependency
const DeleteIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
  </svg>
);
const EditIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
);
const SaveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
  </svg>
);
const CancelIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z" />
  </svg>
);
import {
  useScheduledContributions,
  type ScheduledContribution,
} from '../hooks/useScheduledContributions';
import { useBalance } from '../hooks/useBalance';

interface Props {
  groupId: string;
  groupName: string;
  /** Expected contribution amount for the group */
  contributionAmount: number;
}

interface FormState {
  amount: string;
  scheduledDate: string;
  note: string;
}

const EMPTY_FORM: FormState = { amount: '', scheduledDate: '', note: '' };

function toDatetimeLocal(iso: string) {
  // datetime-local input expects "YYYY-MM-DDTHH:mm"
  return iso.slice(0, 16);
}

export function ContributionScheduler({ groupId, groupName, contributionAmount }: Props) {
  const { getByGroup, add, update, remove } = useScheduledContributions();
  const { xlmBalance } = useBalance({ fetchOnMount: true, refreshInterval: 0 });

  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    amount: String(contributionAmount),
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);

  const scheduled = getByGroup(groupId);

  // ── Balance warning ──────────────────────────────────────────────────────
  const balance = xlmBalance ? parseFloat(xlmBalance) : null;
  const totalScheduled = scheduled.reduce((sum, s) => sum + s.amount, 0);
  const lowBalance = balance !== null && balance < totalScheduled;

  // ── Validation ───────────────────────────────────────────────────────────
  function validate(f: FormState): string | null {
    const amt = parseFloat(f.amount);
    if (!f.amount || isNaN(amt) || amt <= 0) return 'Amount must be a positive number.';
    if (!f.scheduledDate) return 'Please select a date and time.';
    if (new Date(f.scheduledDate) <= new Date()) return 'Scheduled date must be in the future.';
    return null;
  }

  // ── Add ──────────────────────────────────────────────────────────────────
  function handleAdd() {
    const err = validate(form);
    if (err) { setFormError(err); return; }
    setFormError(null);
    add({
      groupId,
      groupName,
      amount: parseFloat(form.amount),
      scheduledDate: new Date(form.scheduledDate).toISOString(),
      note: form.note.trim() || undefined,
    });
    setForm({ ...EMPTY_FORM, amount: String(contributionAmount) });
  }

  // ── Edit ─────────────────────────────────────────────────────────────────
  function startEdit(item: ScheduledContribution) {
    setEditingId(item.id);
    setEditForm({
      amount: String(item.amount),
      scheduledDate: toDatetimeLocal(item.scheduledDate),
      note: item.note ?? '',
    });
  }

  function saveEdit(id: string) {
    const err = validate(editForm);
    if (err) return; // silently ignore — field-level feedback could be added
    update(id, {
      amount: parseFloat(editForm.amount),
      scheduledDate: new Date(editForm.scheduledDate).toISOString(),
      note: editForm.note.trim() || undefined,
    });
    setEditingId(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Schedule a Contribution
      </Typography>

      {/* Balance warning */}
      {lowBalance && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your balance ({xlmBalance} XLM) may be insufficient to cover all scheduled
          contributions ({totalScheduled} XLM total).
        </Alert>
      )}

      {/* Add form */}
      <Stack spacing={2} component="form" noValidate aria-label="Schedule contribution form">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Amount (XLM)"
            type="number"
            inputProps={{ min: 0, step: 'any', 'aria-label': 'Amount in XLM' }}
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            size="small"
            sx={{ flex: 1 }}
          />
          <TextField
            label="Scheduled Date & Time"
            type="datetime-local"
            InputLabelProps={{ shrink: true }}
            inputProps={{ 'aria-label': 'Scheduled date and time' }}
            value={form.scheduledDate}
            onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
            size="small"
            sx={{ flex: 1 }}
          />
        </Stack>
        <TextField
          label="Note (optional)"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          size="small"
          inputProps={{ 'aria-label': 'Note' }}
        />
        {formError && (
          <Typography color="error" variant="caption" role="alert">
            {formError}
          </Typography>
        )}
        <Button variant="contained" onClick={handleAdd} sx={{ alignSelf: 'flex-start' }}>
          Schedule
        </Button>
      </Stack>

      {/* Scheduled list */}
      {scheduled.length > 0 && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Scheduled ({scheduled.length})
          </Typography>
          <Stack spacing={1} role="list" aria-label="Scheduled contributions">
            {scheduled.map((item) =>
              editingId === item.id ? (
                /* ── Edit row ── */
                <Box
                  key={item.id}
                  role="listitem"
                  sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                >
                  <Stack spacing={1}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField
                        label="Amount (XLM)"
                        type="number"
                        inputProps={{ min: 0, step: 'any', 'aria-label': 'Edit amount' }}
                        value={editForm.amount}
                        onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                        size="small"
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        label="Date & Time"
                        type="datetime-local"
                        InputLabelProps={{ shrink: true }}
                        inputProps={{ 'aria-label': 'Edit scheduled date' }}
                        value={editForm.scheduledDate}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, scheduledDate: e.target.value }))
                        }
                        size="small"
                        sx={{ flex: 1 }}
                      />
                    </Stack>
                    <TextField
                      label="Note"
                      value={editForm.note}
                      onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))}
                      size="small"
                      inputProps={{ 'aria-label': 'Edit note' }}
                    />
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<SaveIcon />}
                        onClick={() => saveEdit(item.id)}
                        aria-label="Save changes"
                      >
                        Save
                      </Button>
                      <Button
                        size="small"
                        startIcon={<CancelIcon />}
                        onClick={() => setEditingId(null)}
                        aria-label="Cancel edit"
                      >
                        Cancel
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ) : (
                /* ── Display row ── */
                <Box
                  key={item.id}
                  role="listitem"
                  sx={{
                    p: 1.5,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {item.amount} XLM
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(item.scheduledDate).toLocaleString()}
                      {item.note && ` · ${item.note}`}
                    </Typography>
                  </Box>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => startEdit(item)}
                      aria-label={`Edit scheduled contribution of ${item.amount} XLM`}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Cancel">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => remove(item.id)}
                      aria-label={`Cancel scheduled contribution of ${item.amount} XLM`}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ),
            )}
          </Stack>
        </>
      )}
    </Box>
  );
}
