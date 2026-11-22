import {
  Box,
  Stack,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';

import { Button } from '../Button';

interface ConfirmDialogProps {
  open: boolean;
  amount: number;
  cycleId: number;
  groupName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  amount,
  cycleId,
  groupName,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Confirm Contribution</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {groupName && <Typography variant="subtitle2" fontWeight={600}>{groupName}</Typography>}
          <Typography variant="body2" color="text.secondary">Cycle #{cycleId}</Typography>
          <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2 }}>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Amount</Typography>
                <Typography variant="body2" fontWeight={700}>{amount} XLM</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">Network fee</Typography>
                <Typography variant="body2" color="text.secondary">~0.00001 XLM</Typography>
              </Box>
              <Divider />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight={600}>Total</Typography>
                <Typography variant="body2" fontWeight={700} color="primary">{amount} XLM</Typography>
              </Box>
            </Stack>
          </Box>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            Your wallet will prompt you to approve this transaction.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={onConfirm}>Confirm &amp; Sign</Button>
      </DialogActions>
    </Dialog>
  );
}
