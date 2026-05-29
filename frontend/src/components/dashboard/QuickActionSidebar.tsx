import React, { useState } from 'react';
import { Box, Typography, Button, Stack, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PaymentIcon from '@mui/icons-material/Payment';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import { useToast } from '../Toast/useToast';

type ActionId = 'join' | 'contribute' | 'withdraw';

const ACTIONS = [
  { id: 'join' as ActionId, label: 'Join New Group', icon: <AddIcon />, color: 'primary', dialogTitle: 'Join a Group', placeholder: 'Group ID or invite code' },
  { id: 'contribute' as ActionId, label: 'Make Contribution', icon: <PaymentIcon />, color: 'secondary', dialogTitle: 'Make a Contribution', placeholder: 'Amount in XLM' },
  { id: 'withdraw' as ActionId, label: 'Withdraw Funds', icon: <AccountBalanceIcon />, color: 'warning', dialogTitle: 'Withdraw Funds', placeholder: 'Amount in XLM' },
];

const SUCCESS_MSG: Record<ActionId, string> = {
  join: 'Group join request submitted!',
  contribute: 'Contribution submitted successfully!',
  withdraw: 'Withdrawal request submitted!',
};

export const QuickActionSidebar: React.FC = () => {
  const { addToast } = useToast();
  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [value, setValue] = useState('');

  const handleConfirm = () => {
    if (!activeAction) return;
    addToast({ message: SUCCESS_MSG[activeAction], type: 'success', duration: 4000 });
    setActiveAction(null);
    setValue('');
  };

  const handleClose = () => { setActiveAction(null); setValue(''); };
  const currentAction = ACTIONS.find((a) => a.id === activeAction);

  return (
    <>
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>Quick Actions</Typography>
        <Stack spacing={2}>
          {ACTIONS.map((action) => (
            <Button key={action.id} variant="contained" color={action.color as any} startIcon={action.icon} onClick={() => setActiveAction(action.id)} fullWidth
              sx={{ justifyContent: 'flex-start', py: 1.5, borderRadius: 2, fontWeight: 'bold', textTransform: 'none', boxShadow: 'none', '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } }}>
              {action.label}
            </Button>
          ))}
        </Stack>
      </Paper>

      <Dialog open={Boolean(activeAction)} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight="bold">{currentAction?.dialogTitle}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth variant="outlined" placeholder={currentAction?.placeholder} value={value} onChange={(e) => setValue(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleClose} variant="outlined" sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleConfirm} variant="contained" disabled={!value.trim()} sx={{ textTransform: 'none', fontWeight: 'bold' }}>Confirm</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
