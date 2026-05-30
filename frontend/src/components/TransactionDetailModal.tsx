import React from 'react';
import type { Transaction } from '../types/transaction';
import { Button } from './Button';
import { Badge } from './Badge';
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface Props {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

const TransactionDetailModal: React.FC<Props> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !transaction) return null;

  return (
    <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
        <Typography variant="h6" component="h2" fontWeight="bold">
          Transaction Details
        </Typography>
        <IconButton onClick={onClose} aria-label="Close dialog" edge="end">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Hash</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', mt: 0.5 }}>
                {transaction.hash}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary">Date</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {new Date(transaction.createdAt).toLocaleString()}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">Amount</Typography>
              <Typography variant="h5" fontWeight="bold" sx={{ color: parseFloat(transaction.amount) > 0 ? 'success.main' : 'error.main' }}>
                {transaction.amount} {transaction.assetCode}
              </Typography>
            </Box>
            <Badge variant={transaction.status === 'success' ? 'success' : 'danger'}>
              {transaction.status.toUpperCase()}
            </Badge>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            <Box>
              <Typography variant="body2" color="text.secondary">From</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                {transaction.from}
              </Typography>
            </Box>
            {transaction.to && (
              <Box>
                <Typography variant="body2" color="text.secondary">To</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                  {transaction.to}
                </Typography>
              </Box>
            )}
          </Box>

          {transaction.memo && (
            <Box>
              <Typography variant="body2" color="text.secondary">Memo</Typography>
              <Box sx={{ bgcolor: 'action.hover', p: 1.5, borderRadius: 1, mt: 0.5 }}>
                <Typography variant="body2">{transaction.memo}</Typography>
              </Box>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="secondary" onClick={onClose} style={{ flex: 1 }}>
          Close
        </Button>
        <Button
          variant="primary"
          onClick={() =>
            window.open(
              `https://stellar.expert/explorer/testnet/tx/${transaction.hash}`,
              '_blank'
            )
          }
          style={{ flex: 1 }}
        >
          View on Stellar Expert
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TransactionDetailModal;